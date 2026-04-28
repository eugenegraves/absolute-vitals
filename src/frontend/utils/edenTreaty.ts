import { treaty } from '@elysiajs/eden';
import type { Server } from '../../backend/server';

const serverUrl =
	typeof window !== 'undefined'
		? window.location.origin
		: 'http://localhost:3000';

export const server = treaty<Server>(serverUrl);
