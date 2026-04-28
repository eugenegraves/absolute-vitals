import { eq } from 'drizzle-orm';
import { schema } from '../../../db/schema';
export const getCountHistory = async (
	db: BunSQLDatabase<SchemaType>,
	uid: number
) => {
	const [history] = await db
		.select()
		.from(schema.countHistory)
		.where(eq(schema.countHistory.uid, uid))
		.execute();
	return history;
};

export const createCountHistory = async (
	db: BunSQLDatabase<SchemaType>,
	count: number
) => {
	const [newHistory] = await db
		.insert(schema.countHistory)
		.values({ count })
		.returning();
	return newHistory;
};
