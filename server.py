from flask import Flask, request, jsonify, send_from_directory, Response
import sqlite3
import csv
import io
import os
from datetime import datetime
from dotenv import load_dotenv

# Load local environment variables from .env if present
load_dotenv()

# Initialize Flask with static folder configured
app = Flask(__name__, static_folder='static', static_url_path='/static')

DB_PATH = os.path.join(os.path.dirname(__file__), 'air_quality.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Initialize the local SQLite Database
def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS readings
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  node_id TEXT, lat REAL, lng REAL, 
                  pm25 INTEGER, pm10 INTEGER, aqi INTEGER, 
                  temp REAL, humidity REAL, timestamp DATETIME)''')
    conn.commit()
    conn.close()

# Enable CORS for all API requests
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

# Serve Frontend SPA
@app.route('/')
def serve_index():
    return send_from_directory(os.path.dirname(__file__), 'index.html')

# 1. Endpoint for ESP32 / hardware nodes to send data (HTTP POST)
@app.route('/api/readings', methods=['POST'])
def receive_data():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "No JSON payload received"}), 400
    
    node_id = data.get('node_id', 'unknown_node')
    lat = float(data.get('lat', 0.0) or 0.0)
    lng = float(data.get('lng', 0.0) or 0.0)
    pm25 = int(data.get('pm25', 0) or 0)
    pm10 = int(data.get('pm10', 0) or 0)
    aqi = int(data.get('aqi', 0) or 0)
    temp = float(data.get('temp', 0.0) or 0.0)
    humidity = float(data.get('humidity', 0.0) or 0.0)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''INSERT INTO readings 
                 (node_id, lat, lng, pm25, pm10, aqi, temp, humidity, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (node_id, lat, lng, pm25, pm10, aqi, temp, humidity, now))
    conn.commit()
    inserted_id = c.lastrowid
    conn.close()
    
    print(f"\n[Telemetry] Caught from {node_id}! Temp: {temp}C, AQI: {aqi}, PM2.5: {pm25}")
    return jsonify({
        "status": "success",
        "id": inserted_id,
        "timestamp": now
    }), 201

# 2. Backward-compatible endpoint to fetch latest 50 readings (HTTP GET)
@app.route('/api/readings', methods=['GET'])
def send_data_to_dashboard():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''SELECT * FROM readings ORDER BY id DESC LIMIT 50''')
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in rows])

# 3. Dedicated endpoint for map and analytics (HTTP GET)
@app.route('/api/map-data', methods=['GET'])
def get_map_data():
    limit = request.args.get('limit', default=100, type=int)
    conn = get_db_connection()
    c = conn.cursor()
    
    # Latest reading
    c.execute('''SELECT * FROM readings ORDER BY id DESC LIMIT 1''')
    latest_row = c.fetchone()
    latest = dict(latest_row) if latest_row else None
    
    # Historical readings in chronological order (for Chart.js trends)
    c.execute('''SELECT * FROM readings ORDER BY id DESC LIMIT ?''', (limit,))
    history_rows = c.fetchall()
    conn.close()
    
    history = [dict(ix) for ix in reversed(history_rows)]
    
    return jsonify({
        "status": "success",
        "server_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "latest": latest,
        "history": history,
        "count": len(history)
    })

# 4. Export database records to a downloadable CSV (HTTP GET)
@app.route('/api/export-csv', methods=['GET'])
def export_csv():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''SELECT id, node_id, lat, lng, pm25, pm10, aqi, temp, humidity, timestamp 
                 FROM readings ORDER BY id ASC''')
    rows = c.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow(['ID', 'Node ID', 'Latitude', 'Longitude', 'PM2.5 (ug/m3)', 
                     'PM10 (ug/m3)', 'AQI', 'Temperature (C)', 'Humidity (%)', 'Timestamp'])
    
    for row in rows:
        writer.writerow([row['id'], row['node_id'], row['lat'], row['lng'],
                         row['pm25'], row['pm10'], row['aqi'], row['temp'], 
                         row['humidity'], row['timestamp']])
    
    output.seek(0)
    timestamp_slug = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"air_quality_readings_{timestamp_slug}.csv"
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# 5. Client configuration endpoint for Carto API & Basemap settings (HTTP GET)
@app.route('/api/config', methods=['GET'])
def get_client_config():
    carto_key = os.environ.get('CARTO_API_KEY', '').strip()
    map_style = os.environ.get('CARTO_MAP_STYLE', 'voyager').strip()
    return jsonify({
        "status": "success",
        "hasCartoKey": bool(carto_key),
        "cartoApiKey": carto_key,
        "cartoMapStyle": map_style
    })

if __name__ == '__main__':
    init_db()
    host = os.environ.get('SERVER_HOST', '0.0.0.0')
    port = int(os.environ.get('SERVER_PORT', 5000))
    server_ip = os.environ.get('SERVER_IP', '10.49.96.26')

    print("=" * 65)
    print("Starting Local Flask Server for Smart Air Quality Mapper...")
    print(f"  • Local Dashboard:         http://127.0.0.1:{port}")
    print(f"  • Network / Hotspot URL:   http://{server_ip}:{port}")
    print(f"  • ESP32 POST Endpoint:     http://{server_ip}:{port}/api/readings")
    print("=" * 65)
    app.run(host=host, port=port, debug=False)
