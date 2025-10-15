"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vite_1 = require("vite");
const path_1 = require("path");
// https://vitejs.dev/config
exports.default = (0, vite_1.defineConfig)({
    build: {
        rollupOptions: {
            input: {
                main: (0, path_1.resolve)(__dirname, 'index.html'),
                chat: (0, path_1.resolve)(__dirname, 'chat-window.html'),
            },
        },
    },
});
//# sourceMappingURL=vite.renderer.config.js.map