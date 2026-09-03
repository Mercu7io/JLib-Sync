import sqlite3
import os
import tempfile
import zipfile

tmpdir = tempfile.mkdtemp()
with zipfile.ZipFile('public/example2.jwlibrary', 'r') as z:
    z.extractall(tmpdir)

db_path = os.path.join(tmpdir, 'userData.db')
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name = 'IndependentMedia'")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")
con.close()
