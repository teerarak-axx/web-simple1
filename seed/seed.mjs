// Loads the sample company into an empty database, once: npm run seed
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../src/db.mjs'
import { saveImage } from '../src/images.mjs'

const DIR = join(import.meta.dirname, 'images')

if (db.prepare('SELECT COUNT(*) AS n FROM projects').get().n > 0) {
  console.error('ฐานข้อมูลมีข้อมูลอยู่แล้ว')
  process.exit(1)
}

const load = async (file) => new File([await readFile(join(DIR, file))], file)

const SLOTS = [
  ['logo', 'โลโก้', 'logo-rain-tree.png', 'โลโก้เงาไม้ การ์เด้น'],
  ['hero', 'สไลด์หน้าแรก 1', 'hero-rain-tree-teak-house.jpg', 'ต้นจามจุรีใหญ่ให้ร่มหน้าเรือนไม้สักบนสนามหญ้า'],
  ['hero_2', 'สไลด์หน้าแรก 2', 'mae-rim-teak-house-courtyard.jpg', 'ลานสวนเฟิร์นและอ่างหินหน้าเรือนไม้สัก'],
  ['hero_3', 'สไลด์หน้าแรก 3', 'khao-yai-stone-court-house.jpg', 'บ้านปูนเปลือยกับลานหินและหญ้าประดับ'],
  ['about', 'เกี่ยวกับเรา', 'intro-frangipani-path.jpg', 'ทางเดินหินใต้ต้นลีลาวดี เงาใบไม้ตกบนผนังปูนขาว'],
  ['quote', 'ข้างคำคม', 'intro-leaf-shadow-tiles.jpg', 'เงาใบไม้บนพื้นดินเผากับขอบม้านั่งไม้สัก'],
  ['feature', 'รูปใหญ่กลางหน้า', 'contact-garden-gate-dusk.jpg', 'ประตูไม้เปิดสู่ทางเดินหินมีตะเกียงยามค่ำ'],
  ['mission_1', 'พันธกิจ รูปบน', 'about-plant-nursery.jpg', 'แถวต้นไม้กระถางใต้สแลนในเรือนเพาะชำ'],
  ['mission_2', 'พันธกิจ รูปล่าง', 'mae-kampong-timber-deck.jpg', 'ลานไม้ริมน้ำในสวนรีสอร์ตยามแสงเย็น'],
  ['service_design', 'บริการ ออกแบบ', 'service-landscape-plan.jpg', 'ผังสวนวาดมือบนกระดาษกับตัวอย่างต้นไม้'],
  ['service_build', 'บริการ จัดสวน', 'service-planting-tree.jpg', 'ต้นไม้ห่อตุ้มรากวางลงหลุมปลูกในสวน'],
  ['service_care', 'บริการ ดูแลสวน', 'service-pruning-shears.jpg', 'กรรไกรตัดแต่งกิ่งบนแนวรั้วต้นไทร'],
  ['team', 'ทีมงาน', 'team-garden-crew.jpg', 'ทีมงานเงาไม้ การ์เด้น ถ่ายรูปรวมในสวน'],
  ['og', 'รูปตอนแชร์โซเชียล', 'khao-yai-stone-court-house.jpg', 'บ้านปูนเปลือยกับลานหินและหญ้าประดับ'],
]

const PROJECTS = [
  {
    slug: 'mae-rim-teak-house-garden', title: 'สวนเรือนไม้สัก แม่ริม', type: 'บ้าน', location: 'แม่ริม เชียงใหม่', year: 2023,
    area: '640 ตร.ม.', shade: 'ร่มถึงระเบียง 13:30',
    summary: 'จัดสวนรอบเรือนไม้สักในแม่ริม พื้นที่ 640 ตร.ม. วางต้นไม้เดิมเป็นหลักและเพิ่มร่มให้ระเบียงฝั่งตะวันตก',
    body: 'เจ้าของบ้านอยากนั่งบนระเบียงตอนบ่ายได้โดยไม่ต้องลดม่าน เราเก็บต้นไม้เดิมไว้ทุกต้น แล้วปลูกต้นไม้ใหญ่เพิ่มทางทิศตะวันตกเฉียงใต้ เพื่อให้ร่มถึงระเบียงก่อนแดดแรงที่สุด\nรอบเรือนใช้เฟิร์นและไม้คลุมดินที่ทนร่ม อ่างหินเก่าของบ้านถูกย้ายมาไว้ปลายบันได ให้เสียงน้ำอยู่ใกล้ที่นั่ง',
    cover: ['mae-rim-teak-house-courtyard.jpg', 'ลานสวนเฟิร์นและอ่างหินหน้าเรือนไม้สัก แม่ริม'],
    album: [['mae-rim-stone-basin-lotus.jpg', 'อ่างหินปลูกบัวข้างบันไดไม้สัก'], ['mae-rim-veranda-dusk.jpg', 'ระเบียงเรือนไม้มองสวนที่เปิดไฟยามค่ำ']],
  },
  {
    slug: 'nimman-cafe-courtyard-garden', title: 'ลานร่มจามจุรี คาเฟ่นิมมาน', type: 'คาเฟ่', location: 'นิมมานเหมินท์ เชียงใหม่', year: 2024,
    area: '320 ตร.ม.', shade: 'ร่มเต็มลาน 11:00',
    summary: 'ออกแบบลานคาเฟ่ใต้ต้นจามจุรีย่านนิมมาน พื้นกรวดระบายน้ำและกระบะอิฐ ให้ที่นั่งกลางแจ้งใช้ได้ทั้งวัน',
    body: 'ลานนี้มีต้นจามจุรีอยู่แล้ว โจทย์คือทำอย่างไรให้ลูกค้านั่งใต้ต้นได้โดยรากไม่เสียหาย เราเลือกพื้นกรวดที่น้ำซึมผ่านได้ แทนพื้นคอนกรีตเดิม\nกระบะอิฐทำหน้าที่เป็นทั้งแนวกั้นและที่นั่ง ไฟเส้นบนกิ่งใช้สายรัดแบบไม่รัดเปลือกไม้',
    cover: ['nimman-cafe-rain-tree-courtyard.jpg', 'ลานคาเฟ่พื้นกรวดใต้ต้นจามจุรี ย่านนิมมาน'],
    album: [['nimman-rain-tree-canopy-lights.jpg', 'มองขึ้นไปยังทรงพุ่มจามจุรีและไฟเส้น'], ['nimman-brick-planter-gravel.jpg', 'กระบะอิฐปลูกไม้คลุมดินข้างเก้าอี้ไม้']],
  },
  {
    slug: 'mae-kampong-resort-stream-garden', title: 'สวนริมลำธาร แม่กำปอง', type: 'รีสอร์ต', location: 'แม่ออน เชียงใหม่', year: 2022,
    area: '2,400 ตร.ม.', shade: 'ร่มตลอดวันริมน้ำ',
    summary: 'จัดสวนรีสอร์ตริมลำธารแม่กำปอง 2,400 ตร.ม. ใช้หินและเฟิร์นท้องถิ่น พร้อมสะพานไม้และลานนั่งริมน้ำ',
    body: 'ลำธารเดิมสวยอยู่แล้ว งานหลักของเราจึงเป็นการถอยออกมา เราใช้เฟิร์นและหินจากพื้นที่ใกล้เคียง เพื่อให้สวนเข้ากับป่ารอบข้าง\nสะพานไม้และลานนั่งยกระดับจากพื้น น้ำหลากหน้าฝนจึงผ่านไปได้โดยไม่กระทบโครงสร้าง',
    cover: ['mae-kampong-stream-footbridge.jpg', 'ลำธารมีก้อนหิน เฟิร์นต้น และสะพานไม้ในรีสอร์ตแม่กำปอง'],
    album: [['mae-kampong-moss-boulders-fern.jpg', 'ก้อนหินมีมอสและเฟิร์นริมลำธาร'], ['mae-kampong-timber-deck.jpg', 'ลานไม้ริมน้ำยามแสงเย็น']],
  },
  {
    slug: 'thonglor-townhouse-rooftop-garden', title: 'สวนดาดฟ้าทาวน์โฮม ทองหล่อ', type: 'บ้าน', location: 'ทองหล่อ กรุงเทพฯ', year: 2024,
    area: '85 ตร.ม.', shade: 'ร่มไผ่ 15:00',
    summary: 'ออกแบบสวนดาดฟ้าทาวน์โฮมทองหล่อ 85 ตร.ม. กระบะเบา ระบบน้ำอัตโนมัติ และไผ่บังแดดบ่ายบนพื้นระเบียงไม้',
    body: 'ดาดฟ้ารับน้ำหนักได้จำกัด เราจึงใช้กระบะเหล็กบางกับดินปลูกน้ำหนักเบา และวางจุดหนักไว้ตรงแนวคาน\nแถวไผ่ทางทิศตะวันตกบังแดดบ่ายและบังตึกข้างเคียงไปพร้อมกัน ระบบน้ำหยดตั้งเวลาไว้ เจ้าของจึงเดินทางได้โดยไม่ห่วงต้นไม้',
    cover: ['thonglor-rooftop-garden-skyline.jpg', 'สวนดาดฟ้าทาวน์โฮมกับแนวตึกกรุงเทพฯ ด้านหลัง'],
    album: [['thonglor-bamboo-steel-planter.jpg', 'ไผ่ในกระบะเหล็กทอดเงาบนพื้นไม้'], ['thonglor-rooftop-dusk.jpg', 'สวนดาดฟ้าเปิดไฟยามค่ำ']],
  },
  {
    slug: 'khao-yai-stone-court-garden', title: 'สวนลานหิน เขาใหญ่', type: 'บ้าน', location: 'ปากช่อง นครราชสีมา', year: 2021,
    area: '1,200 ตร.ม.', shade: 'เงาต้นเดียวยามเย็น',
    summary: 'จัดสวนลานหินบ้านพักเขาใหญ่ 1,200 ตร.ม. ใช้กรวด หญ้าประดับ และไม้ทนแล้ง ประหยัดน้ำตลอดหน้าแล้ง',
    body: 'เขาใหญ่แล้งนานกว่าที่หลายคนคิด เราจึงเลือกหญ้าประดับและไม้ทนแล้ง แทนสนามหญ้าที่ต้องรดน้ำทุกวัน\nลานหินกลางบ้านมีต้นไม้ทรงสวยเพียงต้นเดียว ตอนเย็นเงาของมันพาดยาวไปทั้งลาน และกลายเป็นจุดที่เจ้าของบ้านชอบที่สุด',
    cover: ['khao-yai-stone-court-house.jpg', 'บ้านปูนเปลือยกับลานหินและหญ้าประดับ เขาใหญ่'],
    album: [['khao-yai-gravel-stepping-stones.jpg', 'ทางเดินแผ่นหินบนลานกรวดกับหญ้าประดับ'], ['khao-yai-sculptural-tree-sunset.jpg', 'ต้นไม้ต้นเดียวกลางลานหินยามตะวันตก']],
  },
  {
    slug: 'sathorn-office-vertical-garden', title: 'สวนแนวตั้งโถงสำนักงาน สาทร', type: 'สำนักงาน', location: 'สาทร กรุงเทพฯ', year: 2025,
    area: '140 ตร.ม.', shade: 'ไม้ในร่มล้วน',
    summary: 'ติดตั้งสวนแนวตั้งในโถงสำนักงานสาทร พื้นที่ผนัง 140 ตร.ม. เลือกไม้ทนแสงน้อย พร้อมระบบน้ำหมุนเวียน',
    body: 'โถงนี้ได้แสงธรรมชาติเพียงช่วงเช้า เราจึงทดสอบพันธุ์ไม้ในเรือนเพาะชำก่อนหลายเดือน และเลือกเฉพาะชนิดที่อยู่ในแสงน้อยได้จริง\nระบบน้ำหมุนเวียนซ่อนหลังผนัง เปลี่ยนต้นทีละแผงได้โดยไม่ต้องปิดโถง',
    cover: ['sathorn-office-living-wall.jpg', 'สวนแนวตั้งสูงเต็มผนังในโถงสำนักงาน สาทร'],
    album: [['sathorn-living-wall-detail.jpg', 'เฟิร์น ฟิโลเดนดรอน และมอสบนผนังสวนแนวตั้ง'], ['sathorn-lobby-evening.jpg', 'มุมนั่งในโถงข้างสวนแนวตั้งยามเย็น']],
  },
]

const insertSlot = db.prepare('INSERT INTO site_images (key, label, image, alt) VALUES (?, ?, ?, ?)')
for (const [key, label, file, alt] of SLOTS) insertSlot.run(key, label, await saveImage(await load(file), key), alt)

const insertProject = db.prepare(`INSERT INTO projects
  (title, slug, type, location, year, area, shade, summary, body, cover, cover_alt, published, sort)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
const insertImage = db.prepare('INSERT INTO project_images (project_id, image, alt, sort) VALUES (?, ?, ?, ?)')

for (const [i, p] of PROJECTS.entries()) {
  const cover = await saveImage(await load(p.cover[0]), p.slug)
  const { lastInsertRowid: id } = insertProject.run(p.title, p.slug, p.type, p.location, p.year, p.area, p.shade,
    p.summary, p.body, cover, p.cover[1], i + 1)
  for (const [j, [file, alt]] of p.album.entries()) {
    insertImage.run(id, await saveImage(await load(file), p.slug), alt, j + 1)
  }
}
console.log(`seeded ${SLOTS.length} slots, ${PROJECTS.length} projects`)
