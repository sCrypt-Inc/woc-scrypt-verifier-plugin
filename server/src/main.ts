import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import getScriptTemplate from './project.js'

const prisma = new PrismaClient()
const app = express()

app.use(express.json())
app.use(cors())

// Will check wether the specified TX output already has verified code.
app.get('/:network/:txid/:vout', async (req, res) => {
    const network: string = req.params.network
    const txid: string = req.params.txid.toLowerCase()
    const vout = Number(req.params.vout)

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
    if (!(0 <= vout && vout < 2 ** (9 * 8))) {
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
    const mostRecent = await getMostRecentEntry(txid, vout)
    if (!mostRecent) {
        return res.status(404).send('No verified code for this output.')
    }

    return res.json(mostRecent) // TODO: format
})

// Verifies that passed smart contract code produces the correct script
// corresponding to the specified TX output. If valid, stores entry in DB.
app.post('/:network/:txid/:vout', async (req, res) => {
    const network: string = req.params.network
    const txid: string = req.params.txid.toLowerCase()
    const vout = Number(req.params.vout)

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
    if (!(0 <= vout && vout < 2 ** (9 * 8))) {
        return res.status(400).send('Invalid vout.')
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
    // If so, respond with this entry.
    const mostRecent = await getMostRecentEntry(txid, vout)
    if (mostRecent) {
        return res.json(mostRecent) // TODO: format
    }

    const scriptTemplate = await getScriptTemplate(body.code, scryptTSVersion)

    // Get script template and substitute constructor params
    const script = applyConstructorParams(
        scriptTemplate,
        body.abiConstructorParams
    )

    // TODO: Fetch original script from WoC and read compiled one from the fs.

    // TODO: Normalize (remove OP_RETURN data?) both scripts and compare them.

    // TODO: Respond w/ err if failed.

    // TODO: Add new entry to DB and respond normally.

    return res.json({})
})

// TODO: Make port configurable.
app.listen(8001, () => console.log('🚀 Server ready at: http://localhost:8001'))

async function getLatestPackageVersion(packageName: string): Promise<string> {
    const metadata = await fetch.json(`/${packageName}/latest`)
    return metadata.version
}

async function getMostRecentEntry(txid: string, vout: number) {
    const entry = await prisma.entry.findFirst({
        where: {
            txid: txid,
            vout: vout,
        },
        orderBy: {
            timeAdded: 'desc',
        },
    })
    return entry
}

function applyConstructorParams(
    scriptTemplate: string,
    constructorParams: string[]
): string {
    const numParams = scriptTemplate.match(/<.*>/).length
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
