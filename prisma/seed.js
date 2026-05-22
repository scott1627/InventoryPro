const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const fs = require('fs/promises')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  console.log("--- Starting Seeding and Self-Healing Data Recovery ---")

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
  console.log("✓ Basic icons pack seeded.");

  // 3. Seed Categories
  const categoryNames = ["Computer Parts", "74 Series Logic", "test", "Resistors THT", "Resistors SMD", "Restored Media", "Unassigned"];
  const categories = {};
  for (const name of categoryNames) {
    let cat = await prisma.category.findFirst({ where: { name } });
    if (!cat) {
      cat = await prisma.category.create({ data: { name } });
    }
    categories[name] = cat.id;
  }
  console.log("✓ Categories seeded.");

  // 4. Seed Hierarchical Storage Locations
  const locations = {};

  // Parents
  const parentNames = ["Gold Bins", "pink bins", "Red Bins", "Unassigned"];
  for (const name of parentNames) {
    let loc = await prisma.storageLocation.findFirst({ where: { name, parentId: null } });
    if (!loc) {
      loc = await prisma.storageLocation.create({ data: { name } });
    }
    locations[name] = loc.id;
  }

  // Children
  const childrenMap = {
    "Gold Bins": ["A1", "A2", "A3", "A5", "C6"],
    "pink bins": ["A4", "A6", "A7"],
    "Red Bins": ["Bin A1"]
  };

  for (const [parentName, children] of Object.entries(childrenMap)) {
    const parentId = locations[parentName];
    for (const childName of children) {
      const key = `${parentName} / ${childName}`;
      let loc = await prisma.storageLocation.findFirst({
        where: { name: childName, parentId }
      });
      if (!loc) {
        loc = await prisma.storageLocation.create({
          data: { name: childName, parentId }
        });
      }
      locations[key] = loc.id;
    }
  }
  console.log("✓ Storage locations seeded.");

  // 5. Seed baseline inventory parts
  const baselineParts = [
    {
      id: "cmmqfw5i0000h6u3kjzx0w2cc", // Exact CUID for 10k Resistor THT
      name: "10k Resistor THT",
      description: "10k Ohm axial leaded carbon film resistor, through-hole.",
      footprint: "Axial-0.25W",
      qty: 945,
      category: "Resistors THT",
      location: "pink bins / A6",
      imageUrl: "/api/parts/cmmqfw5i0000h6u3kjzx0w2cc/image?v=1775512984036",
      imageType: "image/jpeg",
      datasheetUrl: "/api/parts/cmmqfw5i0000h6u3kjzx0w2cc/datasheet?v=1773501203025",
      datasheetType: "application/pdf"
    },
    {
      name: "NVME Drive",
      description: "Fast solid-state drive storage.",
      qty: 0,
      category: "Computer Parts",
      location: "Gold Bins / A3"
    },
    {
      name: "Dingus",
      description: "The DankMan special. Don't ask. Sub to Dankpods.",
      qty: 44,
      category: "Unassigned",
      location: "pink bins / A6"
    },
    {
      name: "Activity Feed Test",
      description: "Test part for activity feed logic.",
      qty: 92,
      category: "Unassigned",
      location: "Unassigned"
    },
    {
      name: "ECG7402",
      description: "test desc",
      qty: 6,
      category: "74 Series Logic",
      location: "Gold Bins / A5"
    },
    {
      name: "ECG7475",
      description: "4-bit bistable latch.",
      qty: 2,
      category: "74 Series Logic",
      location: "Gold Bins / A2"
    },
    {
      name: "ECG74121",
      description: "Monostable multivibrator.",
      qty: 15,
      category: "74 Series Logic",
      location: "Gold Bins / A1"
    },
    {
      name: "ECG7432",
      description: "TTL OR Gate",
      qty: 11,
      category: "74 Series Logic",
      location: "Gold Bins / A1"
    },
    {
      name: "test2",
      description: "General test part.",
      qty: 0,
      category: "Unassigned",
      location: "pink bins / A4"
    },
    {
      name: "ESP32",
      description: "Wi-Fi & Bluetooth microcontroller SoC.",
      qty: 5,
      category: "test",
      location: "pink bins / A7"
    },
    {
      name: "Verification Part",
      description: "E2E testing validation mock part.",
      qty: 8675309,
      category: "Unassigned",
      location: "Red Bins / Bin A1"
    },
    {
      name: "test part",
      description: "test",
      qty: 5,
      category: "test",
      location: "Gold Bins / C6"
    }
  ];

  for (const bp of baselineParts) {
    const categoryId = bp.category ? categories[bp.category] : categories["Unassigned"]
    const storageLocationId = bp.location ? locations[bp.location] : locations["Unassigned"]

    const existing = bp.id 
      ? await prisma.part.findUnique({ where: { id: bp.id } })
      : await prisma.part.findFirst({ where: { name: bp.name } });

    if (!existing) {
      const partData = {
        name: bp.name,
        description: bp.description || null,
        footprint: bp.footprint || null,
        categoryId,
        storageLocationId,
        imageUrl: bp.imageUrl || null,
        imageType: bp.imageType || null,
        datasheetUrl: bp.datasheetUrl || null,
        datasheetType: bp.datasheetType || null,
        stockLevels: {
          create: {
            quantity: bp.qty
          }
        }
      };

      if (bp.id) {
        partData.id = bp.id;
      }

      await prisma.part.create({ data: partData });
      console.log(`Created baseline part: ${bp.name}`);
    }
  }

  // 6. Self-Healing Media Scanner and Part Recovery
  console.log("Starting self-healing filesystem media scanner...");
  const imagesDir = path.join(process.cwd(), "public", "uploads", "images")
  const datasheetsDir = path.join(process.cwd(), "public", "uploads", "datasheets")

  try {
    const imgFiles = await fs.readdir(imagesDir)
    for (const filename of imgFiles) {
      // If it is a 25-char CUID
      if (filename.length === 25 && filename.startsWith('c')) {
        const partId = filename;
        const existing = await prisma.part.findUnique({ where: { id: partId } });
        if (!existing) {
          console.log(`Self-Healing: Found orphan image file with ID ${partId}. Reconstructing part...`);
          await prisma.part.create({
            data: {
              id: partId,
              name: `Restored Demo Part (${partId.substring(0, 8)})`,
              description: "This part was dynamically reconstructed from files in the uploads folder.",
              categoryId: categories["Restored Media"],
              storageLocationId: locations["Unassigned"],
              imageUrl: `/api/parts/${partId}/image?v=${Date.now()}`,
              imageType: "image/jpeg",
              stockLevels: {
                create: {
                  quantity: 100
                }
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.log("Self-healing image scan skipped or directory empty.");
  }

  try {
    const dsFiles = await fs.readdir(datasheetsDir)
    for (const filename of dsFiles) {
      if (filename.length === 25 && filename.startsWith('c')) {
        const partId = filename;
        const existing = await prisma.part.findUnique({ where: { id: partId } });
        if (existing) {
          if (!existing.datasheetUrl) {
            await prisma.part.update({
              where: { id: partId },
              data: {
                datasheetUrl: `/api/parts/${partId}/datasheet?v=${Date.now()}`,
                datasheetType: "application/pdf"
              }
            });
            console.log(`Self-Healing: Linked restored datasheet to part ${existing.name} (${partId})`);
          }
        } else {
          console.log(`Self-Healing: Found orphan datasheet file with ID ${partId}. Reconstructing part...`);
          await prisma.part.create({
            data: {
              id: partId,
              name: `Restored Demo Part (${partId.substring(0, 8)})`,
              description: "This part was dynamically reconstructed from files in the uploads folder.",
              categoryId: categories["Restored Media"],
              storageLocationId: locations["Unassigned"],
              datasheetUrl: `/api/parts/${partId}/datasheet?v=${Date.now()}`,
              datasheetType: "application/pdf",
              stockLevels: {
                create: {
                  quantity: 100
                }
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.log("Self-healing datasheet scan skipped or directory empty.");
  }

  console.log("--- Seeding and Self-Healing Completed Successfully ---")
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
