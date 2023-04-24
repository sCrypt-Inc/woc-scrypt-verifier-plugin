import { Entry, PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import parseAndVerify, { ContractProp } from './project.js'
import dotenv from 'dotenv'
import prettier from 'prettier'
import axios from 'axios'
import * as CryptoJS from 'crypto-js'
import { execSync } from 'child_process'

// TODO: Test with pushdata constructor params.
// TODO: Test with no constructor params.

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

    // Resolve scrypt-ts version in case user passed tag such as "beta".
    try {
        scryptTSVersion = resolveTagToVersion('scrypt-ts', scryptTSVersion)
    } catch (e) {
        return res.status(400).send(e.message)
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

    // Fetch on-chain script.
    let script: string
    try {
        script = await fetchScriptViaScriptHash(scriptHash, network)
    } catch (e) {
        console.error(e)
        return res.status(400).send('Could not fetch original script.')
    }

    let contractProps: ContractProp[]
    try {
        contractProps = await parseAndVerify(body.code, scryptTSVersion, script)
    } catch (e) {
        console.error(e)
        return res
            .status(400)
            .send('Something went wrong when building the smart contract.')
    }

    try {
        // Add new entry to DB and respond normally.
        const codePretty = prettier.format(body.code, prettierOpt)
        const newEntry = await addEntry(
            network,
            scriptHash,
            scryptTSVersion,
            codePretty,
            'main.ts',
            contractProps
        )
        return res.json(newEntry)
    } catch (e) {
        console.error(e)
        return res.status(400).send(e.toString())
    }
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
                contractProps: true,
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
                contractProps: true,
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
    contractProps: ContractProp[]
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
    contractProps.forEach(async (p: ContractProp) => {
        await prisma.contractProps.create({
            data: {
                name: p.name,
                val: p.val,
                entryId: newEntry.id,
            },
        })
    })

    return newEntry
}

async function fetchScriptViaScriptHash(
    scriptHash: string,
    network: string
): Promise<string> {
    const historyURL = `https://api.whatsonchain.com/v1/bsv/${network}/script/${scriptHash}/history`
    const historyResp = await axios.get(historyURL)
    if (historyResp.data.length == 0) {
        throw new Error('No tx found with specified scripthash.')
    }

    for (let i = 0; i < historyResp.data.length; i++) {
        const txid = historyResp.data[i].tx_hash
        const txURL = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`
        const txResp = await axios.get(txURL)
        const vout = txResp.data.vout
        for (let j = 0; j < vout.length; j++) {
            const out = vout[j]
            const originalScript = out.scriptPubKey.hex
            const originalScriptHash = getScriptHash(originalScript)
            if (originalScriptHash == scriptHash) {
                return originalScript
            }
        }
    }

    // Should never get here.
    throw new Error('Script match error.')
}

function getScriptHash(scriptPubKeyHex: string): string {
    const scriptHash = CryptoJS.default.enc.Hex.stringify(
        CryptoJS.default.SHA256(CryptoJS.default.enc.Hex.parse(scriptPubKeyHex))
    )
    return scriptHash.match(/.{2}/g)?.reverse()?.join('') ?? ''
}

function resolveTagToVersion(packageName: string, tag: string): string {
    const errMsg = `Failed to resolve tag "${tag}" for package "${packageName}".`
    try {
        const cmdOutput = execSync(`npm show ${packageName}@${tag} version`)
        const version = cmdOutput.toString().trim()
        if (version == '') {
            throw new Error(errMsg)
        }
        return version
    } catch (e) {
        throw new Error(errMsg)
    }
}
