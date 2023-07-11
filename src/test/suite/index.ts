import path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');
	const files = await glob('**/**.test.js', { cwd: testsRoot })

	// Add files to the test suite
	files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

	return new Promise((resolve, reject) => mocha.run(failures => {
		if (failures > 0) {
			const error = new Error(`${failures} tests failed.`)
			console.error(error)
			return reject(error);
		}

		return resolve()
	}));
}
