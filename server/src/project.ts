import fs from 'fs'
import path from 'path'
import os from 'os'
import { compileContract } from 'scryptlib/dist/utils.js'
import { execSync } from 'child_process'

function randHexStr(length: number): string {
    const chars = '0123456789abcdef'
    let hex = ''
    for (let i = 0; i < length; i++) {
        hex += chars[Math.floor(Math.random() * chars.length)]
    }
    return hex
}

export default async function getScriptTemplate(
    sourceCode: string,
    scryptTSVersion: string
): Promise<string> {
    // TODO: Sandbox!!!
    // TODO: Make sure to completely remove all generated files, even if
    //       an exception does occur.

    const baseDir = os.tmpdir() // TODO: Make configurable via dotenv

    const targetDir = path.join(baseDir, randHexStr(16) + '_woc-scrypt')
    const srcDir = path.join(targetDir, 'src')

    fs.mkdirSync(srcDir, { recursive: true })

    // Apply scrypt-ts version.
    const packageJSONRightVer = Object.assign({}, packageJSON)
    packageJSONRightVer['dependencies']['scrypt-ts'] = scryptTSVersion

    // Write package.json
    fs.writeFileSync(
        path.join(targetDir, 'package.json'),
        JSON.stringify(packageJSONRightVer)
    )

    // Write tsconfig.json
    fs.writeFileSync(
        path.join(targetDir, 'tsconfig.json'),
        JSON.stringify(tsconfigJSON)
    )

    // Write source code
    const srcFile = path.join(srcDir, 'main.ts')
    fs.writeFileSync(srcFile, sourceCode)

    // npm i
    execSync('npm i', { cwd: targetDir })

    // Build TS code.
    execSync('npm run build', { cwd: targetDir })

    // TODO: Prettify code.

    // Compile resulting .scrypt file.
    const outDir = path.join(targetDir, 'scrypts', 'src')
    const scryptFile = path.join(outDir, 'main.scrypt')
    compileContract(scryptFile, {
        out: outDir,
        artifact: true,
    })

    const contractJSONFile = path.join(outDir, 'main.json')
    const contractJSON = JSON.parse(
        fs.readFileSync(contractJSONFile).toString()
    )

    fs.rmSync(targetDir, { recursive: true })

    return contractJSON.hex
}

const packageJSON = {
    name: 'tmp',
    version: '0.1.0',
    scripts: {
        build: 'tsc',
    },
    dependencies: {
        'scrypt-ts': 'beta',
    },
    devDependencies: {
        '@types/node': '^18.11.10',
        typescript: '=4.8.4',
    },
}

const tsconfigJSON = {
    compilerOptions: {
        target: 'es2021',
        lib: ['es2021'],
        experimentalDecorators: true,
        module: 'commonjs',
        rootDir: './',
        moduleResolution: 'node',
        outDir: './dist',
        esModuleInterop: true,
        skipLibCheck: true,
        sourceMap: true,
        plugins: [
            {
                transform: 'scrypt-ts/dist/transformation/transformer',
                outDir: './scrypts',
                transformProgram: true,
            },
        ],
    },
    include: ['src/**/*.ts'],
}
