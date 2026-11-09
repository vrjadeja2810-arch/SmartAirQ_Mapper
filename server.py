from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)

# Initialize the local SQLite Database[cite: 5]
def init_db():
    conn = sqlite3.connect('air_quality.db')
    c = conn.cursor()
    # Create the table for storing sensor readings
    c.execute('''CREATE TABLE IF NOT EXISTS readings
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  node_id TEXT, lat REAL, lng REAL, 
                  pm25 INTEGER, pm10 INTEGER, aqi INTEGER, 
                  temp REAL, humidity REAL, timestamp DATETIME)''')
    conn.commit()
    conn.close()

# 1. The endpoint the ESP32 sends data TO (HTTP POST)[cite: 5]
@app.route('/api/readings', methods=['POST'])
def receive_data():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload received"}), 400
    
    # Save the incoming data to the SQLite database
    conn = sqlite3.connect('air_quality.db')
    c = conn.cursor()
    c.execute('''INSERT INTO readings 
                 (node_id, lat, lng, pm25, pm10, aqi, temp, humidity, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (data.get('node_id'), data.get('lat'), data.get('lng'), 
               data.get('pm25'), data.get('pm10'), data.get('aqi'), 
               data.get('temp'), data.get('humidity'), datetime.now()))
    conn.commit()
    conn.close()
    
    print(f"\n✅ Data caught from {data.get('node_id')}! Temp: {data.get('temp')}C, AQI: {data.get('aqi')}")
    return jsonify({"status": "success"}), 201

# 2. The endpoint the Dashboard calls to fetch data FROM (HTTP GET)[cite: 5]
@app.route('/api/readings', methods=['GET'])
def send_data_to_dashboard():
    conn = sqlite3.connect('air_quality.db')
    conn.row_factory = sqlite3.Row # Formats the rows into dictionaries
    c = conn.cursor()
    # Fetch the 50 most recent readings
    c.execute('''SELECT * FROM readings ORDER BY id DESC LIMIT 50''')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in rows])

# Start the local server
if __name__ == '__main__':
    init_db()
    print("Starting Local Flask Server for Smart Air Quality Mapper...")
    # host='0.0.0.0' allows the ESP32 on the hotspot to see this laptop
    app.run(host='0.0.0.0', port=5000)