import { Entry, PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import getScriptTemplate from './project.js'
import axios, { AxiosResponse } from 'axios'
import dotenv from 'dotenv'
import prettier from 'prettier'

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

// Will check wether the specified TX output already has verified code.
router.get('/:network/:txid/:voutIdx', async (req, res) => {
    const network: string = req.params.network
    const txid: string = req.params.txid.toLowerCase()
    const voutIdx = Number(req.params.voutIdx)

    // Check network.
    if (network != 'main' && network != 'test') {
        return res.status(400).send('Invalid network.')
    }

    // Check txid format.
    const pattern = RegExp(/[0-9a-f]{64}/)
    if (!pattern.test(txid)) {
        return res.status(400).send('Invalid TXID format.')
    }

    // Check vout.
    if (!(0 <= voutIdx && voutIdx < 2 ** (9 * 8))) {
        return res.status(400).send('Invalid vout.')
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
            txid,
            voutIdx,
            scryptTSVersion
        )
    } else {
        entries = await getMostRecentEntries(network, txid, voutIdx)
    }
    if (!entries || entries.length == 0) {
        return res.status(404).send('No verified code for this output.')
    }

    return res.json(entries)
})

// Verifies that passed smart contract code produces the correct script
// corresponding to the specified TX output. If valid, stores entry in DB.
router.post('/:network/:txid/:voutIdx', async (req, res) => {
    const network: string = req.params.network
    const txid: string = req.params.txid.toLowerCase()
    const voutIdx = Number(req.params.voutIdx)

    // Check network.
    if (network != 'main' && network != 'test') {
        return res.status(400).send('Invalid network.')
    }

    // Check txid format.
    const pattern = RegExp(/[0-9a-f]{64}/)
    if (!pattern.test(txid)) {
        return res.status(400).send('Invalid TXID format.')
    }

    // Check vout.
    if (!(0 <= voutIdx && voutIdx < 2 ** (9 * 8))) {
        return res.status(400).send('Invalid vout idx.')
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
        txid,
        voutIdx,
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

    // Fetch original script from WoC and compare with the generated one.
    // TODO: Test with large transactions.
    const fetchURL = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`
    let fetchResp: AxiosResponse
    try {
        fetchResp = await axios.get(fetchURL)
    } catch (e) {
        console.error(e)
        return res.status(400).send('Could not find original transaction.')
    }

    if (voutIdx >= fetchResp.data.vout.lenght) {
        return res.status(400).send('Invalid vout idx.')
    }

    const isValid = verify(
        scriptTemplate,
        fetchResp.data.vout[voutIdx].scriptPubKey.hex
    )
    if (!isValid) {
        return res.status(400).send('Script mismatch.')
    }

    // Add new entry to DB and respond normally.
    const codePretty = prettier.format(body.code, prettierOpt)
    const newEntry = addEntry(
        network,
        txid,
        voutIdx,
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
    txid: string,
    voutIdx: number,
    scryptTSVersion?: string
): Promise<Entry[]> {
    if (typeof scryptTSVersion !== 'undefined') {
        const res = await prisma.entry.findFirst({
            where: {
                txid: txid,
                voutIdx: voutIdx,
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
                txid: txid,
                voutIdx: voutIdx,
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
    txid: string,
    voutIdx: number,
    scryptTSVersion: string,
    code: string,
    fName: string,
    constrAbiParams: ConstrParam[]
) {
    const newEntry = await prisma.entry.create({
        data: {
            network: network,
            txid: txid,
            voutIdx: voutIdx,
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

function verify(scriptTemplate: string, script: string): boolean {
    // Convert template to regex.
    const templateRegex = scriptTemplate.replaceAll(/<(.*?)>/g, '[a-fA-F0-9]*?')

    const match = script.match(templateRegex)

    return match ? true : false
}
