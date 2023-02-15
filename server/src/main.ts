//import { PrismaClient } from '@prisma/client'
import cors from 'cors'
import express from 'express'

//const prisma = new PrismaClient()
const app = express()

app.use(express.json())
app.use(cors())

// Will check wether the specified TX output already has verified code.
app.get('/:txid/:vout', async (req, res) => {
    console.log(req.params.txid)
    console.log(req.params.vout)

    // TODO: Check txid and vout format.
    
    // TODO: Check if scrypt-ts version was specified. (req.query.ver)
    //       If not, query the latest one from NPM.
    
    // TODO: Fetch most recent result from DB and respond.

    res.json({})
})

// Verifies that passed smart contract code produces the correct script 
// corresponding to the specified TX output. If valid, stores entry in DB.
app.post('/:txid/:vout', async (req, res) => {
    console.log(req.params.txid)
    console.log(req.params.vout)
    
    const data = req.body
    
    console.log(data)

    // TODO: Check txid and vout format.
    
    // TODO: Check if scrypt-ts version was specified. (req.query.ver)
    //       If not, query the latest one from NPM.
    
    // TODO: Check if DB already has an entry.
    //       If so, respond with this entry.
    
    // TODO: Create temporary scrypt-ts project (using scrypt-cli), insert
    //       passed source code file(s), build, pass constructor args and compile it.
    
    // TODO: Fetch original script from WoC and read compiled one from the fs.
    
    // TODO: Normalize (remove OP_RETURN data?) both scripts and compare them.
    
    // TODO: Respond w/ err if failed.
    
    // TODO: Add new entry to DB and respond normally.
    
    res.json({})
})

// TODO: Make port configurable.
app.listen(8001, () => console.log('🚀 Server ready at: http://localhost:8001'))
