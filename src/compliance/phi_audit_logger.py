import sqlite3
from datetime import datetime

class PHIAuditLogger:
    def __init__(self, db_path="audit/phi_access.db"):
        self.conn = sqlite3.connect(db_path)
        self._init_db()
    
    def _init_db(self):
        self.conn.execute('''CREATE TABLE IF NOT EXISTS access_logs (
            timestamp TEXT,
            user_id TEXT,
            patient_id TEXT,
            resource_type TEXT,
            operation TEXT,
            justification TEXT,
            model_used TEXT
        )''')
    
    def log_access(self, user_id, patient_id, resource_type, 
                 operation, justification, model=None):
        self.conn.execute('''INSERT INTO access_logs VALUES (
            ?, ?, ?, ?, ?, ?, ?
        )''', (
            datetime.utcnow().isoformat(),
            user_id,
            patient_id,
            resource_type,
            operation,
            justification,
            model
        ))
        self.conn.commit()
    
    def generate_report(self, start_date, end_date):
        cursor = self.conn.execute('''SELECT * FROM access_logs
            WHERE timestamp BETWEEN ? AND ?''', (start_date, end_date))
        return pd.DataFrame(cursor.fetchall(), 
            columns=["timestamp", "user", "patient", "resource", 
                    "operation", "reason", "model"])