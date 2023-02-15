import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const demo = `
import { assert, method, prop, SmartContract } from 'scrypt-ts'

export class Demo extends SmartContract {
    @prop()
    readonly x: bigint

    @prop()
    readonly y: bigint

    // The values of the x and y properties get passed via the
    // smart contract's constructor.
    constructor(x: bigint, y: bigint) {
        super(...arguments)
        this.x = x
        this.y = y
    }

    // Contract internal method to compute x + y
    @method()
    sum(a: bigint, b: bigint): bigint {
        return a + b
    }

    // Public method which can be unlocked by providing the solution to x + y
    @method()
    public add(z: bigint) {
        assert(z == this.sum(this.x, this.y), 'add check failed')
    }

    // Public method which can be unlocked by providing the solution to x - y
    @method()
    public sub(z: bigint) {
        assert(z == this.x - this.y, 'sub check failed')
    }
}
`

const entryData: any = [
    {
        scriptHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
        Src: {
            create: [
                {
                    fName: 'demo.ts',
                    code: demo,
                },
            ],
        },
    },
]

async function main() {
    console.log(`Start seeding ...`)
    for (const e of entryData) {
        const entry = await prisma.entry.create({
            data: e,
        })
        console.log(`Created entry with id: ${entry.id}`)
    }
    console.log(`Seeding finished.`)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
