import { Entry, PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'
import fetch from 'npm-registry-fetch'
import getContractJSON from './project.js'
import dotenv from 'dotenv'
import prettier from 'prettier'
import axios from 'axios'
import * as CryptoJS from 'crypto-js'
import { deserializer } from 'scryptlib/dist/deserializer.js'
import { bsv } from 'scryptlib'

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

    let contractJSON: object
    try {
        contractJSON = await getContractJSON(body.code, scryptTSVersion)
    } catch (e) {
        console.error(e)
        return res
            .status(400)
            .send('Something went wrong when building the smart contract.')
    }

    const scriptTemplate = contractJSON['hex']
    const abi = contractJSON['abi']

    try {
        const [isValid, constructorParams] = verify(scriptTemplate, abi, script)
        if (!isValid) {
            return res.status(400).send('Script mismatch.')
        }

        // Add new entry to DB and respond normally.
        const codePretty = prettier.format(body.code, prettierOpt)
        const newEntry = addEntry(
            network,
            scriptHash,
            scryptTSVersion,
            codePretty,
            'main.ts',
            constructorParams
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
                constrAbiParams: {
                    orderBy: {
                        pos: 'asc',
                    },
                },
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
                constrAbiParams: {
                    orderBy: {
                        pos: 'asc',
                    },
                },
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
    abi: object[],
    script: string
): [boolean, ConstrParam[]] {
    script = truncateOpReturn(script)
    const isMatch = matchTemplate(script, scriptTemplate)
    if (!isMatch) {
        return [false, []]
    }

    // Parse out template hex data.
    const templateData = getTemplateData(script, scriptTemplate)

    // Const check if contract even has an explicit constructor.
    const constructorAbi = getConstructorAbi(abi)
    if (!constructorAbi) {
        return [true, []]
    }

    const constructorParamLabels = scriptTemplate.match(/(?<=<).*?(?=>)/g)

    //let pos = 0
    //const templateDataScript = new bsv.Script(templateData)
    //const res: ConstrParam[] = []
    //for (const chunk of templateDataScript.chunks) {
    //    const paramName = constructorParamLabels.shift()
    //    let hexVal: string
    //    if (chunk['buf']) {
    //        hexVal = chunk['buf'].toString('hex')
    //    } else {
    //        hexVal = int2hex(BigInt(chunk.opcodenum))
    //    }
    //    res.push({ pos: pos, name: paramName, val: hexVal })
    //    pos++
    //}

    // Interpret pushdata and match with param names.
    const res: ConstrParam[] = []
    const pos = 0
    for (let i = 0; i < templateData.length; i += 2) {
        const hexVal = templateData.slice(i, i + 2)
        const intVal = parseInt(hexVal, 16)

        let numBytesEnd: number
        // CheckOP_0 - OP_16
        if (intVal >= 81 && intVal <= 96) {
            const paramName = constructorParamLabels.shift()
            res.push({ pos: pos, name: paramName, val: hexVal })
            continue
        }
        // Check 0x01-0x4B,
        else if (intVal >= 0 && intVal <= 75) {
            numBytesEnd = i
        }
        // Check 0x4C
        else if (intVal == 76) {
            numBytesEnd = i + 4
        }
        // Check 0x4D
        else if (intVal == 77) {
            numBytesEnd = i + 6
        }
        // Check 0x4E
        else if (intVal == 78) {
            numBytesEnd = i + 8
        }
        // If something else, abort with error.
        else {
            throw new Error('Error while interpreting constructor param data.')
        }

        const paramName = constructorParamLabels.shift()
        let numBytesHex: string
        if (numBytesEnd == i) {
            numBytesHex = hexVal
        } else {
            numBytesHex = templateData.slice(i + 2, numBytesEnd)
        }
        const numBytesInt = parseInt(numBytesHex, 16)

        const iNext = numBytesEnd + numBytesInt * 2
        const dataRest = templateData.slice(numBytesEnd, iNext)
        res.push({ pos: pos, name: paramName, val: hexVal + dataRest })

        i = iNext
    }

    // Parse primitive types based on ABI.
    const parsedRes = parsePrimitiveTypes(res, constructorAbi)

    return [true, parsedRes]
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

function getConstructorAbi(abi: object[]): object {
    for (let i = 0; i < abi.length; i++) {
        const abiVal = abi[i]
        if (abiVal['type'] == 'constructor') {
            return abiVal
        }
    }
    return undefined
}

function parsePrimitiveTypes(
    constructorParams: ConstrParam[],
    constructorAbi: object
): ConstrParam[] {
    const res: ConstrParam[] = []

    for (let i = 0; i < constructorParams.length; i++) {
        const param = constructorParams[i]

        const paramVal = param.val
        const paramType = constructorAbi['params'][i]['type']

        try {
            let parsedVal: string
            // TODO: Pubkeys 33 bytes long and stuff?
            if (!['int', 'privkey', 'bool'].includes(paramType.toLowerCase())) {
                parsedVal = paramVal
            } else {
                parsedVal = deserializer(paramType, paramVal).toString()
            }
            res.push({
                pos: param.pos,
                name: param.name,
                val: parsedVal,
            })
        } catch (e) {
            res.push({ pos: param.pos, name: param.name, val: param.val })
        }
    }

    return res
}

function matchTemplate(script: string, scriptTemplate: string): boolean {
    // Replace template placeholders with a simple asterisk.
    scriptTemplate = scriptTemplate.replaceAll(/<.*>/g, '*')

    const pLength = scriptTemplate.length
    const tLength = script.length
    let pIndex = 0
    let tIndex = 0
    let wildcardIndex = -1
    let matchIndex = -1

    while (tIndex < tLength) {
        if (
            pIndex < pLength &&
            (scriptTemplate[pIndex] === script[tIndex] ||
                scriptTemplate[pIndex] === '*')
        ) {
            if (scriptTemplate[pIndex] === '*') {
                wildcardIndex = pIndex
                matchIndex = tIndex
                pIndex++
            } else {
                pIndex++
                tIndex++
            }
        } else if (wildcardIndex !== -1) {
            pIndex = wildcardIndex + 1
            matchIndex++
            tIndex = matchIndex
        } else {
            return false
        }
    }

    while (pIndex < pLength && scriptTemplate[pIndex] === '*') {
        pIndex++
    }

    return pIndex === pLength
}

function truncateOpReturn(script: string): string {
    const res = new bsv.Script('')
    const scriptObj = new bsv.Script(script)
    for (let i = 0; i < scriptObj.chunks.length; i++) {
        const opcode = scriptObj.chunks[i]
        if (opcode.opcodenum == 106) {
            break
        }
        res.add(opcode)
    }
    return res.toHex()
}

function getTemplateData(script: string, scriptTemplate: string): string {
    let res = script

    // Throw out prefix
    for (let i = 0; i < scriptTemplate.length; i++) {
        const c = scriptTemplate[i]
        if (c == '<') {
            res = res.slice(i)
            break
        }
    }

    // Throw out suffix
    let j = 0
    for (let i = scriptTemplate.length - 1; i >= 0; i--) {
        const c = scriptTemplate[i]
        if (c == '>') {
            res = res.slice(0, -j)
            break
        }
        j++
    }

    return res
}
