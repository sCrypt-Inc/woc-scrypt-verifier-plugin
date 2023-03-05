import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import Docker from 'dockerode'
import * as stream from 'stream'
import concat from 'concat-stream'
import ts from 'typescript'
import dotenv from 'dotenv'

dotenv.config()

const BASE_DIR = process.env.BASE_DIR || os.tmpdir()

const docker = new Docker()

interface VolumeMapping {
    source: string
    target: string
}

async function runCommandInContainer(
    imageName: string,
    command: string,
    volumeMapping: VolumeMapping,
    workDir: string
): Promise<string> {
    const createOptions = {
        Image: imageName,
        AttachStdin: false,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        HostConfig: {
            Binds: [`${volumeMapping.source}:${volumeMapping.target}`],
            NetworkMode: 'none',
        },
        WorkingDir: workDir,
        Cmd: ['/bin/sh', '-c', command],
    }

    const outputStream = new stream.PassThrough()
    let output: any
    await docker
        .run(imageName, createOptions.Cmd, outputStream, createOptions)
        .then(function (data) {
            output = data[0]
            const container = data[1]
            // Remove the container
            return container.remove()
        })

    if (output.StatusCode != 0) {
        throw new Error('Error while parsing script.')
    }

    // Use concat-stream to convert the output stream to a string
    const result = await new Promise<string>((resolve, _) => {
        outputStream.pipe(
            concat((data: Buffer) => {
                resolve(data.toString())
            })
        )
    })

    return result
}

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

function checkSourceCode(sourceFile: ts.SourceFile): string {
    let onlyScrypTsImports = true
    let onlySmartContractClasses = true
    let onlyImportsAndClasses = true

    let smartContractClassName = undefined

    let smartContractCnt = 0

    ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier['text']
            if (!moduleSpecifier.includes('scrypt-ts')) {
                onlyScrypTsImports = false
            }
        } else if (ts.isClassDeclaration(node)) {
            const baseTypes = node.heritageClauses
                ?.map((clause) => clause.types)
                ?.reduce((a, b) => a.concat(b), [])
            if (
                !baseTypes?.some((type) => {
                    const typeName = type.expression['escapedText']
                    if (typeName === 'SmartContract') {
                        smartContractCnt += 1
                        smartContractClassName =
                            node.name.escapedText.toString()
                    }
                    return (
                        typeName === 'SmartContract' ||
                        typeName === 'SmartContractLib'
                    )
                })
            ) {
                onlySmartContractClasses = false
            }
        } else if (node.parent == undefined) {
            if (
                !ts.isInterfaceDeclaration(node) &&
                !ts.isTypeAliasDeclaration(node) &&
                node.kind != 1
            ) {
                onlyImportsAndClasses = false
            }
        }
    })

    if (!onlyScrypTsImports) {
        throw new Error(
            "The file contains imports from other libraries than 'scrypt-ts'"
        )
    }

    if (!onlySmartContractClasses) {
        throw new Error(
            "The file contains classes that don't extend 'SmartContract' or 'SmartContractLib'"
        )
    }

    if (!onlyImportsAndClasses) {
        throw new Error(
            'The source code only allows classes, interface and type alias declarations'
        )
    }

    if (smartContractCnt != 1) {
        throw new Error(
            'The source code must have a single SmartContract class declaration'
        )
    }

    return smartContractClassName
}

function prepareSourceCode(sourceFile: ts.SourceFile): string {
    //const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    //    return (node) => {
    //        function visit(node: ts.Node): ts.Node {
    //            if (node.parent == undefined && ts.isClassDeclaration(node)) {
    //            }
    //            return ts.visitEachChild(node, visit, context);
    //        }
    //        return ts.visitNode(node, visit);
    //    };
    //};
    const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
        return (sourceFile) => {
            const visitor = (node: ts.Node): ts.Node => {
                if (node.parent == undefined && ts.isClassDeclaration(node)) {
                    const exportModifier = ts.factory.createModifier(
                        ts.SyntaxKind.ExportKeyword
                    )
                    return ts.factory.updateClassDeclaration(
                        node,
                        undefined,
                        [exportModifier],
                        node.name,
                        undefined,
                        node.heritageClauses,
                        node.members
                    )
                }

                return ts.visitEachChild(node, visitor, context)
            }

            return ts.visitNode(sourceFile, visitor)
        }
    }

    // Apply the transformer to the source file
    const result = ts.transform(sourceFile, [transformer])

    // Get the modified source file from the result
    const transformedSourceFile = result.transformed[0]

    // Serialize the modified source file to source code
    const printer = ts.createPrinter()

    return printer.printFile(transformedSourceFile)
}

export default async function parseAndVerify(
    sourceCode: string,
    scryptTSVersion: string,
    script: string
): Promise<ContractProp[]> {

    const targetDir = prepareTargetDir(BASE_DIR, scryptTSVersion)
    const srcDir = path.join(targetDir, 'src')

    // Write raw script data
    const scriptFile = path.join(targetDir, 'contract.script')
    fs.writeFileSync(scriptFile, script)

    // Check passed source code structure.
    const sourceFile = ts.createSourceFile(
        'main.ts',
        sourceCode,
        ts.ScriptTarget.ES2022
    )
    const smartContractClassName = checkSourceCode(sourceFile)

    // Prepare source code
    sourceCode = prepareSourceCode(sourceFile)

    // Write runner function file
    const runnerSrc = `
import { ${smartContractClassName} } from './main'

function bigIntReplacer(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

(async () => { 
    // Call compile method 
    // Read raw script from file and construct contract obj 
    // Serialize to JSON and return to STDOUT 
    const oldLog = console.log
    console.log = () => {}
    await ${smartContractClassName}.compile()
    
    const contract = (${smartContractClassName} as any).fromLockingScript('${script}')
    delete contract['delegateInstance']
    delete contract['enableUpdateEMC']

    console.log = oldLog
    console.log(JSON.stringify(contract, bigIntReplacer))
})()
`
    const runnerFile = path.join(srcDir, 'runner.ts')
    fs.writeFileSync(runnerFile, runnerSrc)

    // Write source code
    const srcFile = path.join(srcDir, 'main.ts')
    fs.writeFileSync(srcFile, sourceCode)

    // Build TS code.
    execSync('npm run build', { cwd: targetDir })

    // Exec runner script and parse output
    const imageName = 'node:19.6.1-buster'
    const command = 'npx --no-notify --no-update-notifier ts-node src/runner.ts'
    const volumeMapping: VolumeMapping = { source: targetDir, target: '/proj' }
    const runnerRes = await runCommandInContainer(
        imageName,
        command,
        volumeMapping,
        '/proj'
    )

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
        'ts-node': '^10.9.1',
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
