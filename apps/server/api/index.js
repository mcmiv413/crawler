import { buildApp } from '../src/app.js';
let app = null;
async function getApp() {
    if (!app) {
        const instance = await buildApp();
        await instance.ready();
        app = instance;
    }
    return app;
}
export default async function handler(req, res) {
    const fastify = await getApp();
    fastify.routing(req, res);
}
//# sourceMappingURL=index.js.map