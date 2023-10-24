import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import ts from 'typescript'
import dotenv from 'dotenv'

dotenv.config()

const BASE_DIR = process.env.BASE_DIR || os.tmpdir()

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
    const contractsDir = path.join(srcDir, 'contracts')
    if (!fs.existsSync(target)) {
        fs.mkdirSync(contractsDir, { recursive: true })

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
        fs.rmSync(contractsDir, { recursive: true, force: true })
        fs.mkdirSync(contractsDir, { recursive: true })

        const artifactsDir = path.join(target, 'artifacts')
        fs.rmSync(artifactsDir, { recursive: true, force: true })

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
                node.kind != 240 &&
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
    const contractsDir = path.join(srcDir, 'contracts')

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
    const runnerSrc = `import { readFileSync } from 'fs'
import { ${smartContractClassName} } from './main'

function bigIntReplacer(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return value
}

(async () => { 
  try {
    // Call compile method 
    // Read raw script from file and construct contract obj 
    // Serialize to JSON and return to STDOUT 
    const oldLog = console.log
    console.log = () => {}
    await ${smartContractClassName}.loadArtifact()
    
    const script = readFileSync('contract.script').toString()
    const contract = (${smartContractClassName} as any).fromLockingScript(script)

    delete contract['delegateInstance']
    delete contract['enableUpdateEMC']
    delete contract['_txBuilders']

    console.log = oldLog
    console.log(JSON.stringify(contract, bigIntReplacer))
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1); // Optionally exit the process for a clean shutdown
  }
})()
`
    const runnerFile = path.join(contractsDir, 'runner.ts')
    fs.writeFileSync(runnerFile, runnerSrc)

    // Write source code
    const srcFile = path.join(contractsDir, 'main.ts')
    fs.writeFileSync(srcFile, sourceCode)

    // Build TS code and compile contract.
    execSync('npm run compile', { cwd: targetDir })

    // Exec runner script and parse output
    const command =
        'npx scrypt-cli compile > /dev/null 2>&1 && npx --no-notify --no-update-notifier ts-node src/contracts/runner.ts'
    try {
        const runnerRes = execSync(command, {
            cwd: targetDir,
            encoding: 'utf-8',
        })
        const contractData = JSON.parse(runnerRes, bigIntReviver)

        const res: ContractProp[] = []
        for (const [key, val] of Object.entries(contractData)) {
            res.push({ name: key, val: val.toString() })
        }

        return res
    } catch (error) {
        console.error('Error executing command:', error)
        return []
    }
}

const packageJSON = {
    name: 'tmp',
    version: '0.1.0',
    scripts: {
        compile: 'tsc && npx -y scrypt-cli compile',
    },
    dependencies: {
        'scrypt-ts': undefined,
        'scrypt-cli': 'latest',
    },
    devDependencies: {
        '@types/node': '^18.11.10',
        'ts-node': '^10.9.1',
        typescript: '^5.1.6',
    },
}

const tsconfigJSON = {
    compilerOptions: {
        /* Language and Environment */
        target: 'ES2020' /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
        lib: [
            'ES2020',
        ] /* Specify a set of bundled library declaration files that describe the target runtime environment. */,
        experimentalDecorators:
            true /* Enable experimental support for TC39 stage 2 draft decorators. */,
        /* Modules */
        module: 'commonjs' /* Specify what module code is generated. */,
        moduleResolution:
            'node' /* Specify how TypeScript looks up a file from a given module specifier. */,
        outDir: './dist' /* Specify an output folder for all emitted files. */,
        esModuleInterop:
            true /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */,
        /* Type Checking */
        strict: false /* Enable all strict type-checking options. */,
        skipLibCheck: true /* Skip type checking all .d.ts files. */,
        sourceMap: true,
        declaration: true,
        resolveJsonModule: true,
    },
    include: ['src/**/*.ts'],
}
