import fs from 'fs'
import path from 'path'
import os from 'os'
import { compileContract } from 'scryptlib/dist/utils.js'
import { execSync } from 'child_process'

function prepareTargetDir(baseDir: string, scryptTSVersion: string): string {
    // Check if dir for this scrypt-ts version already exists.
    // If not, create it.
    const target = path.join(baseDir, 'woc-plugin_' + scryptTSVersion)
    const srcDir = path.join(target, 'src')
    if (!fs.existsSync(target)) {
        fs.mkdirSync(srcDir, { recursive: true })

        // Apply scrypt-ts version.
        const packageJSONRightVer = Object.assign({}, packageJSON)
        packageJSONRightVer['dependencies']['scrypt-ts'] = scryptTSVersion

        // Write package.json
        fs.writeFileSync(
            path.join(target, 'package.json'),
            JSON.stringify(packageJSONRightVer)
        )

        // Write tsconfig.json
        fs.writeFileSync(
            path.join(target, 'tsconfig.json'),
            JSON.stringify(tsconfigJSON)
        )

        // npm i
        execSync('npm i', { cwd: target })
    } else {
        // Clean up.
        // TODO: Maybe make this a script in package.json?
        fs.rmSync(srcDir, { recursive: true, force: true })
        fs.mkdirSync(srcDir)

        const scryptsDir = path.join(target, 'scrypts')
        fs.rmSync(scryptsDir, { recursive: true, force: true })

        const distDir = path.join(target, 'dist')
        fs.rmSync(distDir, { recursive: true, force: true })
    }

    return target
}

export default async function getContractJSON(
    sourceCode: string,
    scryptTSVersion: string
): Promise<object> {
    // TODO: Sandbox!!!
    // TODO: Make sure to completely remove all generated files, even if
    //       an exception does occur.

    const baseDir = os.tmpdir() // TODO: Make configurable via dotenv

    const targetDir = prepareTargetDir(baseDir, scryptTSVersion)
    const srcDir = path.join(targetDir, 'src')

    // Write source code
    const srcFile = path.join(srcDir, 'main.ts')
    fs.writeFileSync(srcFile, sourceCode)

    // Build TS code.
    execSync('npm run build', { cwd: targetDir })

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

    return contractJSON
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
        '@types/node': '^18.11.0',
        typescript: '=4.8.4',
        rimraf: '^3.0.2',
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
