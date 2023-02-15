import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import bodyParser from 'body-parser'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')))

// API routes
app.get('/api/hello', (req: Request, res: Response, next: NextFunction) => {
    console.log(req, res, next)
    res.send('Hello from the server!')
})

// Catch-all route for serving the React app
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    console.log(req, res, next)
    res.sendFile(path.join(__dirname, '/client/build/index.html'))
})

const port = process.env.PORT || 5000
app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
})
