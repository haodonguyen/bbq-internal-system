# Debian slim rather than Alpine: Prisma's query and schema engines need OpenSSL,
# and the musl builds are a recurring source of "could not parse schema engine
# response" failures.
FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# Dev dependencies are kept: the container runs `prisma migrate deploy` and the
# ts-node seed on start.
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3001

# Migrations run at container start so a fresh volume comes up schema-correct.
# The seed only fills an empty database, so restarting never clobbers real data.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.ts --only-if-empty && node dist/main"]
