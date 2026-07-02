import dns from "node:dns";
import mongoose from "mongoose";

// El DNS del router/ISP local a veces rechaza las consultas SRV/TXT que
// necesita "mongodb+srv://" para resolver el clúster de Atlas. Forzamos un
// resolutor público conocido para esas consultas.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Reutiliza la conexión entre hot-reloads / invocaciones de API routes.
const globalForMongoose = globalThis as unknown as { mongooseCache?: MongooseCache };

const cache: MongooseCache = globalForMongoose.mongooseCache ?? { conn: null, promise: null };
globalForMongoose.mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error("Falta la variable de entorno MONGODB_URI");
    }
    // Si la conexión falla, se limpia la promesa cacheada para que la
    // siguiente llamada reintente en vez de quedar repitiendo el mismo error.
    cache.promise = mongoose.connect(MONGODB_URI).catch((err) => {
      cache.promise = null;
      throw err;
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}
