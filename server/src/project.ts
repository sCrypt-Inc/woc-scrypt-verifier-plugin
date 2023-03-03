import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'

export type ContractProp = {
    name: string
    val: string
}

function bigIntReviver(_: string, value: any): any {
    if (typeof value === 'string') {
        const bigIntRegex = /^-?\d+n$/
        if (bigIntRegex.test(value)) {
            return BigInt(value.slice(0, -1))
        }
    }
    return value
}

function renameContract(sourceCode: string, contractNameNew: string): string {
    const match = sourceCode.match(/class\s+([^\s]+)\s+extends\s+SmartContract/)
    if (!match) {
        throw new Error('No contract class found in source code.')
    }
    const contractNameOld = match[1]

    return sourceCode.replaceAll(contractNameOld, contractNameNew)
}

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

export default async function parseAndVerify(
    sourceCode: string,
    scryptTSVersion: string,
    script: string
): Promise<ContractProp[]> {
    // TODO: Sandbox!!!

    const baseDir = os.tmpdir() // TODO: Make configurable via dotenv

    const targetDir = prepareTargetDir(baseDir, scryptTSVersion)
    const srcDir = path.join(targetDir, 'src')

    // Write raw script data
    const scriptFile = path.join(targetDir, 'contract.script')
    fs.writeFileSync(scriptFile, script)

    // Rename contract class
    // TODO: Must be a better way.
    sourceCode = renameContract(sourceCode, 'Main')

    // Add runner function to source code
    const RUNNER_SRC = `
// Call compile method 
// Read raw script from file and construct contract obj 
// Serialize to JSON and return to STDOUT 
function bigIntReplacer(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}


(async () => { 
    const oldLog = console.log
    console.log = () => {}
    await Main.compile()
    console.log = oldLog
    
    const contract = (Main as any).fromLockingScript('${script}')
    delete contract['delegateInstance']
    delete contract['enableUpdateEMC']

    console.log(JSON.stringify(contract, bigIntReplacer))
})()
`
    sourceCode += '\n\n' + RUNNER_SRC

    // Write source code
    const srcFile = path.join(srcDir, 'main.ts')
    fs.writeFileSync(srcFile, sourceCode)

    // Build TS code.
    execSync('npm run build', { cwd: targetDir })

    // Exec runner script and parse output
    const runnerRes = execSync('npx ts-node src/main.ts', {
        cwd: targetDir,
    }).toString()
    const contractData = JSON.parse(runnerRes, bigIntReviver)

    const res: ContractProp[] = []
    for (const [key, val] of Object.entries(contractData)) {
        res.push({ name: key, val: val.toString() })
    }

    return res
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
