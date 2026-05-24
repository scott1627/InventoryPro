const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log("--- Starting Seeding ---")

  // 1. Admin User Setup
  const adminPassword = await bcrypt.hash('password123', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  })
  console.log("✓ Admin user verified.")

  // 2. Basic Icon Pack
  const icons = [
    { name: "Resistor", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-4 4 8 4-8 4 8 2-4h2"/></svg>' },
    { name: "Capacitor", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h8"/><path d="M22 12h-8"/><path d="M10 6v12"/><path d="M14 6v12"/></svg>' },
    { name: "IC / Microchip", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"/><path d="M9 6V2"/><path d="M15 6V2"/><path d="M9 22v-4"/><path d="M15 22v-4"/><path d="M6 9H2"/><path d="M6 15H2"/><path d="M22 9h-4"/><path d="M22 15h-4"/></svg>' },
    { name: "Memory / RAM", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8" width="20" height="8" rx="2" ry="2"/><path d="M6 16v4"/><path d="M10 16v4"/><path d="M14 16v4"/><path d="M18 16v4"/><path d="M4 12h.01"/><path d="M20 12h.01"/></svg>' },
    { name: "Diode", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"/><path d="M22 12h-6"/><path d="M16 6v12"/><polygon points="8,6 16,12 8,18"/></svg>' },
    { name: "LED", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14h6"/><path d="M22 14h-6"/><path d="M16 8v12"/><polygon points="8,8 16,14 8,20"/><path d="M12 4l3-3"/><path d="M15 1h3v3"/><path d="M17 6l3-3"/><path d="M20 3h3v3"/></svg>' },
    { name: "Inductor", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4"/><path d="M22 12h-4"/><path d="M6 12a3 3 0 0 1 6 0"/><path d="M12 12a3 3 0 0 1 6 0"/></svg>' },
    { name: "Transistor", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"/><path d="M8 6v12"/><path d="M8 10l6-4v-4"/><path d="M8 14l6 4v4"/><path d="M12 10l-2 2 2 2"/></svg>' },
    { name: "Connector", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"/><path d="M8 8v8h4v-8z"/><path d="M12 10h4"/><path d="M12 14h4"/><path d="M16 8v8h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2z"/></svg>' },
    { name: "Microcontroller", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2" ry="2"/><path d="M9 5V2"/><path d="M15 5V2"/><path d="M9 22v-3"/><path d="M15 22v-3"/><path d="M5 9H2"/><path d="M5 15H2"/><path d="M22 9h-3"/><path d="M22 15h-3"/><path d="M9 9h6v6H9z"/></svg>' },
    { name: "Switch", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6" /><path d="M8 12l8-5" /><path d="M16 12h6" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="12" r="1" fill="currentColor" /></svg>' },
    { name: "Light", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7" /><path d="M7.05 7.05l9.9 9.9" /><path d="M16.95 7.05l-9.9 9.9" /><path d="M2 12h3" /><path d="M19 12h3" /></svg>' },
    { name: "Pin Connector", svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1" /><path d="M7 8V5" /><path d="M12 8V5" /><path d="M17 8V5" /><path d="M7 16v3" /><path d="M12 16v3" /><path d="M17 16v3" /></svg>' },
  ];

  for (const icon of icons) {
    const existing = await prisma.icon.findFirst({ where: { name: icon.name } });
    if (!existing) {
      await prisma.icon.create({
        data: {
          name: icon.name,
          content: Buffer.from(icon.svg),
          type: 'image/svg+xml'
        }
      });
    }
  }
  console.log("✓ Basic icons pack seeded.")
  console.log("--- Seeding Completed Successfully ---")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
