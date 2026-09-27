import type { D1Database } from '@cloudflare/workers-types';
import type { Customer } from './types';

const uuid = () => crypto.randomUUID();

export class CustomerService {
  constructor(private db: D1Database) {}

  /** Guest-checkout first: find by email, else by phone, else create. Never force registration. */
  async findOrCreateGuest(data: {
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    locale?: string | null;
    market?: string | null;
  }): Promise<Customer> {
    const email = data.email?.trim().toLowerCase() || null;
    const phone = data.phone?.trim() || null;

    if (email) {
      const found = await this.db.prepare(`SELECT * FROM customers WHERE lower(email) = ?`).bind(email).first<Customer>();
      if (found) return found;
    }
    if (!email && phone) {
      const found = await this.db.prepare(`SELECT * FROM customers WHERE phone = ?`).bind(phone).first<Customer>();
      if (found) return found;
    }

    const id = uuid();
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO customers (id, email, phone, first_name, last_name, locale, market, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(id, email, phone, data.first_name ?? null, data.last_name ?? null, data.locale ?? null, data.market ?? null, now, now).run();

    return { id, email, phone, first_name: data.first_name ?? null, last_name: data.last_name ?? null, locale: data.locale ?? null, market: data.market ?? null, created_at: now, updated_at: now };
  }

  async getById(id: string): Promise<Customer | null> {
    return (await this.db.prepare(`SELECT * FROM customers WHERE id = ?`).bind(id).first<Customer>()) ?? null;
  }
}
