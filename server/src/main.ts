import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import getScriptTemplate from './project.js'
import axios, { AxiosResponse } from 'axios'
import dotenv from 'dotenv'

dotenv.config()

const SERVER_PORT = process.env.SERVER_PORT || '8001'

const prisma = new PrismaClient()
const app = express()

app.use(express.json())
app.use(cors())

// Will check wether the specified TX output already has verified code.
app.get('/:network/:txid/:voutIdx', async (req, res) => {
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

    // Check if scrypt-ts version was specified.
    // If not, query the latest one from NPM.
    let scrytpTSVersion = req.query.ver
    if (!scrytpTSVersion) {
        scrytpTSVersion = await getLatestPackageVersion('scrypt-ts')
    }
    if (typeof scrytpTSVersion !== 'string') {
        return res.status(400).send('Invalid scrypt-ts version.')
    }

    // Fetch most recent result from DB and respond.
    const mostRecent = await getMostRecentEntry(network, txid, voutIdx)
    if (!mostRecent) {
        return res.status(404).send('No verified code for this output.')
    }

    return res.json(mostRecent)
})

// Verifies that passed smart contract code produces the correct script
// corresponding to the specified TX output. If valid, stores entry in DB.
app.post('/:network/:txid/:voutIdx', async (req, res) => {
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
    let scryptTSVersion = req.query.ver
    if (!scryptTSVersion) {
        scryptTSVersion = await getLatestPackageVersion('scrypt-ts')
    }
    if (typeof scryptTSVersion !== 'string') {
        return res.status(400).send('Invalid scrypt-ts version.')
    }

    // Check body structure.
    const body = req.body
    const bodyKeys = new Set<string>(['code', 'abiConstructorParams'])
    if (!Object.keys(body).every((key) => bodyKeys.has(key))) {
        return res.status(400).send('Invalid request body.')
    }

    // Check if DB already has an entry.
    const mostRecent = await getMostRecentEntry(network, txid, voutIdx)
    if (mostRecent) {
        return res.json('Entry already exists.')
    }

    const scriptTemplate = await getScriptTemplate(body.code, scryptTSVersion)

    // Get script template and substitute constructor params
    let script: string
    try {
        script = applyConstructorParams(
            scriptTemplate,
            body.abiConstructorParams
        )
    } catch (e) {
        return res.status(400).send(e.toString())
    }

    // Fetch original script from WoC and compare with the generated one.
    // TODO: Test with large transactions.
    const fetchURL = `https://api.whatsonchain.com/v1/bsv/${network}/tx/hash/${txid}`
    let fetchResp: AxiosResponse
    try {
        fetchResp = await axios.get(fetchURL)
    } catch (e) {
        return res.status(400).send('Could not find original transaction.')
    }

    if (voutIdx >= fetchResp.data.vout.lenght) {
        return res.status(400).send('Invalid vout idx.')
    }

    if (script != fetchResp.data.vout[voutIdx].scriptPubKey.hex) {
        return res.status(400).send('Script mismatch.')
    }

    // Add new entry to DB and respond normally.
    const newEntry = addEntry(network, txid, voutIdx, body.code, 'main.ts') // TODO: fName
    return res.json(newEntry)
})

app.listen(SERVER_PORT, () =>
    console.log(`🚀 Server ready at: http://localhost:${SERVER_PORT}`)
)

async function getLatestPackageVersion(packageName: string): Promise<string> {
    const metadata = await fetch.json(`/${packageName}/latest`)
    return metadata.version
}

async function getMostRecentEntry(
    network: string,
    txid: string,
    voutIdx: number
) {
    const entry = await prisma.entry.findFirst({
        where: {
            txid: txid,
            voutIdx: voutIdx,
            network: network,
        },
        include: {
            src: true,
        },
        orderBy: {
            timeAdded: 'desc',
        },
    })
    return entry
}

async function addEntry(
    network: string,
    txid: string,
    voutIdx: number,
    code: string,
    fName: string
) {
    const newEntry = await prisma.entry.create({
        data: {
            network: network,
            txid: txid,
            voutIdx: voutIdx,
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
    return newEntry
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
