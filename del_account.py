import sqlite3
conn = sqlite3.connect('figuritas.db')
conn.execute("DELETE FROM users WHERE email='facusanlucas@gmail.com'")
conn.commit()
print("Cuenta eliminada OK")
conn.close()
