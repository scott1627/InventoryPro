FROM node:20-alpine

# Install libc6-compat for Prisma
RUN apk add --no-cache libc6-compat openssl postgresql-client

WORKDIR /app

COPY package*.json ./
# Copy prisma directory so postinstall scripts have access to the schema
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD npx prisma generate && npx prisma db push && npm run dev
