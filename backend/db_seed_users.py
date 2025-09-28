# db_seed_users.py
import sqlite3

con = sqlite3.connect('dev.db')
cur = con.cursor()

# jadval ustunlari: id, full_name, phone, email, password_hash, role, branch_id (branch_id bo'lsa None qoldiramiz)
# Agar id 2 va 3 band bo'lsa, INSERT OR IGNORE ishlaydi
cur.execute("INSERT OR IGNORE INTO users (id, full_name, phone, email, password_hash, role) VALUES (2,'Shukrullo','998000000002','shukr@ex.com','x','manager')")
cur.execute("INSERT OR IGNORE INTO users (id, full_name, phone, email, password_hash, role) VALUES (3,'Olimjon','998000000003','olim@ex.com','x','manager')")

con.commit()

print('USERS:', list(cur.execute('SELECT id, full_name, role FROM users ORDER BY id')))
print('ORDERS (last 10):', list(cur.execute('SELECT id, client_id, manager_id FROM orders ORDER BY id DESC LIMIT 10')))

con.close()
