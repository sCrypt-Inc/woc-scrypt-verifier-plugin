import { Entry, PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import getScriptTemplate from './project.js'
import dotenv from 'dotenv'
import prettier from 'prettier'
import { createHash } from 'crypto'

dotenv.config()

const SERVER_PORT = process.env.SERVER_PORT || '8001'
const URL_PREFIX = process.env.URL_PREFIX || ''

const prettierOpt = {
    semi: false,
    printWidth: 80,
    tabWidth: 4,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    parser: 'typescript',
}

const prisma = new PrismaClient()
const app = express()

app.use(cors())
app.use(express.json())

// Create a router for an URL prefix
const router = express.Router()
app.use(URL_PREFIX, router)

// Will check wether the specified script hash output already has verified code.
router.get('/:network/:scriptHash', async (req, res) => {
    const network: string = req.params.network
    const scriptHash: string = req.params.scriptHash.toLowerCase()

    // Check network.
    if (network != 'main' && network != 'test') {
        return res.status(400).send('Invalid network.')
    }

    // Check scriptHash format.
    const pattern = RegExp(/[0-9a-f]{64}/)
    if (!pattern.test(scriptHash)) {
        return res.status(400).send('Invalid TXID format.')
    }

    // Fetch most recent result(s) from DB and respond.
    const scryptTSVersion = req.query.ver
    if (
        typeof scryptTSVersion !== 'string' &&
        typeof scryptTSVersion !== 'undefined'
    ) {
        return res.status(400).send('Invalid scrypt-ts version format.')
    }

    let entries: Entry[]
    if (scryptTSVersion) {
        entries = await getMostRecentEntries(
            network,
            scriptHash,
            scryptTSVersion
        )
    } else {
        entries = await getMostRecentEntries(network, scriptHash)
    }
    if (!entries || entries.length == 0) {
        return res.status(404).send('No verified code for this output.')
    }

    return res.json(entries)
})

// Verifies that passed smart contract code produces the correct script
// corresponding to the specified script hash. If valid, stores entry in DB.
router.post('/:network/:scriptHash', async (req, res) => {
    const network: string = req.params.network
    const scriptHash: string = req.params.scriptHash.toLowerCase()

    // Check network.
    if (network != 'main' && network != 'test') {
        return res.status(400).send('Invalid network.')
    }

    // Check scriptHash format.
    const pattern = RegExp(/[0-9a-f]{64}/)
    if (!pattern.test(scriptHash)) {
        return res.status(400).send('Invalid TXID format.')
    }

    // Check if scrypt-ts version was specified.
    // If not, query the latest one from NPM.
    // TODO: Pass via JSON body?
    let scryptTSVersion = req.query.ver
    if (!scryptTSVersion) {
        scryptTSVersion = await getLatestPackageVersion('scrypt-ts')
    }
    if (typeof scryptTSVersion !== 'string') {
        return res.status(400).send('Invalid scrypt-ts version.')
    }

    // If we already have an entry, then check if the specified
    // scrypt-ts version is equal to the entries one.
    // If so, we can abort.
    const entries = await getMostRecentEntries(
        network,
        scriptHash,
        scryptTSVersion
    )
    if (entries.length > 0) {
        return res
            .status(400)
            .send(
                'Output already has verified code for the specified scrypt-ts version.'
            )
    }

    // Check body structure.
    const body = req.body
    const bodyKeys = new Set<string>(['code', 'abiConstructorParams'])
    if (!Object.keys(body).every((key) => bodyKeys.has(key))) {
        return res.status(400).send('Invalid request body.')
    }

    let scriptTemplate: string
    try {
        scriptTemplate = await getScriptTemplate(body.code, scryptTSVersion)
    } catch (e) {
        console.error(e)
        return res
            .status(400)
            .send('Something went wrong when building the smart contract.')
    }

    try {
        const isValid = verify(
            scriptTemplate,
            body.abiConstructorParams,
            scriptHash
        )
        if (!isValid) {
            return res.status(400).send('Script mismatch.')
        }
    } catch (e) {
        console.error(e)
        return res.status(400).send(e.toString())
    }

    // Add new entry to DB and respond normally.
    const codePretty = prettier.format(body.code, prettierOpt)
    const newEntry = addEntry(
        network,
        scriptHash,
        scryptTSVersion,
        codePretty,
        'main.ts',
        []
    )
    return res.json(newEntry)
})

app.listen(SERVER_PORT, () =>
    console.log(`🚀 Server ready at: http://localhost:${SERVER_PORT}`)
)

async function getLatestPackageVersion(packageName: string): Promise<string> {
    const metadata = await fetch.json(`/${packageName}/latest`)
    return metadata.version
}

async function getMostRecentEntries(
    network: string,
    scriptHash: string,
    scryptTSVersion?: string
): Promise<Entry[]> {
    if (typeof scryptTSVersion !== 'undefined') {
        const res = await prisma.entry.findFirst({
            where: {
                scriptHash: scriptHash,
                network: network,
                scryptTSVersion: scryptTSVersion,
            },
            include: {
                src: true,
                constrAbiParams: true,
            },
            orderBy: {
                timeAdded: 'desc',
            },
        })
        if (!res) {
            return []
        }
        return [res]
    } else {
        const res = await prisma.entry.findMany({
            where: {
                scriptHash: scriptHash,
                network: network,
            },
            include: {
                src: true,
                constrAbiParams: true,
            },
            orderBy: {
                timeAdded: 'desc',
            },
        })
        const alreadyGot = new Set()
        return res.filter((entry) => {
            if (alreadyGot.has(entry.scryptTSVersion)) {
                return false
            }
            alreadyGot.add(entry.scryptTSVersion)
            return true
        })
    }
}

async function addEntry(
    network: string,
    scriptHash: string,
    scryptTSVersion: string,
    code: string,
    fName: string,
    constrAbiParams: ConstrParam[]
) {
    const newEntry = await prisma.entry.create({
        data: {
            network: network,
            scriptHash: scriptHash,
            scryptTSVersion: scryptTSVersion,
            src: {
                create: [
                    {
                        fName: fName,
                        code: code,
                    },
                ],
            },
        },
    })

    // TODO: Batch create.
    constrAbiParams.forEach(async (p: ConstrParam, i: number) => {
        await prisma.constrAbiParams.create({
            data: {
                pos: i,
                name: p.name,
                val: p.val,
                entryId: newEntry.id,
            },
        })
    })

    return newEntry
}

type ConstrParam = {
    pos: number
    name: string
    val: string
}

function verify(
    scriptTemplate: string,
    abiConstructorParams: string[],
    scriptHash
): boolean {
    // Get script template and substitute constructor params
    const script = applyConstructorParams(scriptTemplate, abiConstructorParams)
    const binaryData = hexToBinary(script)
    const hash = sha256Hash(binaryData)
    console.log(hash)
    return hash == scriptHash
}

function applyConstructorParams(
    scriptTemplate: string,
    constructorParams: string[]
): string {
    const numParams = (scriptTemplate.match(/<.*?>/g) || []).length
    if (numParams != constructorParams.length) {
        throw new Error('Invalid number of constructor params.')
    }

    let res = ''

    let placeholderFlag = false
    let paramIdx = 0
    for (const c of scriptTemplate) {
        if (c == '<') {
            placeholderFlag = true
            res += constructorParams[paramIdx]
            paramIdx++
            continue
        } else if (c == '>') {
            placeholderFlag = false
            continue
        }

        if (!placeholderFlag) {
            res += c
        }
    }

    return res
}

function hexToBinary(hex: string): Uint8Array {
    const binary = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
        binary[i / 2] = parseInt(hex.slice(i, i + 2), 16)
    }
    return binary
}

function sha256Hash(binary: Uint8Array): string {
    const hash = createHash('sha256')
    hash.update(binary)
    return hash.digest('hex')
}
