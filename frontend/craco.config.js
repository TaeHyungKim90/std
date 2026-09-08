const path = require('path');

/**
 * CRA는 jsconfig의 baseUrl만 인식합니다.
 * TS6에서 baseUrl이 deprecated되어 paths("*": ./src/*)로 옮겼으므로,
 * webpack/Jest resolve에 src를 동일하게 넣습니다.
 */
module.exports = {
	webpack: {
		configure: (config) => {
			const src = path.resolve(__dirname, 'src');
			const modules = config.resolve.modules || ['node_modules'];
			if (!modules.includes(src)) {
				config.resolve.modules = [...modules, src];
			}
			return config;
		},
	},
	jest: {
		configure: (config) => {
			const dirs = config.moduleDirectories || ['node_modules'];
			if (!dirs.includes('src')) {
				config.moduleDirectories = [...dirs, 'src'];
			}
			return config;
		},
	},
};
