import { handle } from 'hono/vercel';
import { createApp } from '../server/api/index.js';

const app = createApp();

export { createApp };
export default handle(app);
