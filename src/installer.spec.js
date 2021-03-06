const fs = require('fs')
const { execSync } = require('child_process')
const { resolveGolumbusBinaryFullPath } = require('./installer')
const {
    installForFish,
    installForZsh,
    installGoto,
    generateGotoScript,
} = require('./installer')
const { detectShell, getUserHome, isWindows } = require('./system')
jest.mock('fs')
jest.mock('./system')
jest.mock('child_process')

describe('installer', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        getUserHome.mockReturnValue('/Users/someUser')
        fs.readFileSync.mockImplementation(filePath => {
            if (filePath.endsWith('goto.zsh')) {
                return 'function goto() { cd "$(gol "$1" "$2")" }\n'
            } else if (filePath.endsWith('goto.fish')) {
                return `function goto --description 'Proxy command for going to golumbus location'\ncd (gol $argv)\nend`
            } else if (filePath.endsWith('.zshrc')) {
                return '# some zshrc config\n'
            }
        })

        execSync.mockReturnValue(
            Buffer.from(
                '/Users/someUser/.nvm/versions/node/v14.0.0/bin/gol\n',
                'utf-8',
            ),
        )
    })

    describe('installForFish', () => {
        it('should write fish script to file if not existing yet', async () => {
            fs.existsSync.mockReturnValue(false)

            const result = await installForFish()

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
            expect(result).toEqual(
                "Created the Fish function file ~/.config/fish/functions/goto.fish. Open a new terminal to use the 'goto' command.",
            )
        })

        it('should not write fish script if already existing', async () => {
            fs.existsSync.mockReturnValue(true)

            const result = await installForFish()

            expect(fs.writeFileSync).not.toHaveBeenCalled()
            expect(result).toEqual(
                "Fish function file /.config/fish/functions/goto.fish already in place. 'goto' command should be present in your Fish shell.",
            )
        })
    })

    describe('installForZsh', () => {
        it('should append zsh function to file', async () => {
            await installForZsh()

            expect(fs.appendFileSync).toHaveBeenCalledTimes(1)
        })

        it('should not append zsh function to file if function already present there', async () => {
            fs.readFileSync = jest.fn().mockImplementation(fileName => {
                if (fileName.endsWith('.zshrc')) {
                    return 'function goto() {\ncd $(gol "$1" "$2")\n}\n'
                } else {
                    return 'zsh script'
                }
            })

            await installForZsh()

            expect(fs.appendFileSync).not.toHaveBeenCalled()
        })
    })

    describe('installGoto', () => {
        it('should install command for specific shell name "zsh"', async () => {
            await installGoto('zsh')

            expect(fs.appendFileSync).toHaveBeenCalledTimes(1)
        })

        it('should install command for specific shell name "fish"', async () => {
            await installGoto('fish')

            expect(fs.writeFileSync).toHaveBeenCalledTimes(1)
        })

        it('should auto-detect shell "zsh" and install', async () => {
            detectShell.mockReturnValue('zsh')

            await installGoto(undefined)

            expect(fs.appendFileSync).toHaveBeenCalledTimes(1)
        })
    })

    describe('resolveGolumbusBinaryFullPath', () => {
        it('should resolve Golumbus binary full path', async () => {
            expect(await resolveGolumbusBinaryFullPath()).toEqual(
                '/Users/someUser/.nvm/versions/node/v14.0.0/bin/gol',
            )
        })
    })

    describe('generateGotoScript', () => {
        it('should generate script including absolute path to gol binary for Windows', async () => {
            isWindows.mockReturnValue(true)

            const scriptContent = await generateGotoScript('goto.zsh')

            expect(scriptContent).toEqual(
                'function goto() { cd "$(/Users/someUser/.nvm/versions/node/v14.0.0/bin/gol "$1" "$2")" }\n',
            )
            expect(execSync).toHaveBeenCalledWith('where gol')
        })

        it('should generate script including absolute path to gol binary for non-Windows', async () => {
            isWindows.mockReturnValue(false)

            const scriptContent = await generateGotoScript('goto.zsh')

            expect(scriptContent).toEqual(
                'function goto() { cd "$(/Users/someUser/.nvm/versions/node/v14.0.0/bin/gol "$1" "$2")" }\n',
            )
            expect(execSync).toHaveBeenCalledWith('which gol')
        })
    })
})
