require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Telemetry = require('./models/Telemetry');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB conectado correctamente'))
  .catch(err => console.error('Error MongoDB:', err));

// === APIs ===

// POST: Recibe datos del ESP32 con DHT22
app.post('/api/telemetry', async (req, res) => {
  try {
    const { temp, hum, timestamp } = req.body;

    // Validación básica
    if (temp === undefined || hum === undefined || !timestamp) {
      return res.status(400).json({ error: 'Faltan campos: temp, hum o timestamp' });
    }

    // Convertir el string de timestamp (formato: "2025-04-05 14:32:10") a Date
    const fecha = new Date(timestamp);
    if (isNaN(fecha.getTime())) {
      return res.status(400).json({ error: 'Formato de timestamp inválido' });
    }

    const nuevoDato = new Telemetry({
      temp,
      hum,
      timestamp: fecha
    });

    await nuevoDato.save();

    console.log(`Dato guardado → ${temp}°C | ${hum}% | ${timestamp}`);
    res.status(201).json({ 
      message: 'Dato DHT22 guardado correctamente',
      id: nuevoDato._id 
    });

  } catch (err) {
    console.error('Error guardando dato:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET: Todos los registros (ordenados por fecha descendente)
app.get('/api/telemetry', async (req, res) => {
  try {
    const datos = await Telemetry.find().sort({ timestamp: -1 });

    // Convertir a hora local (Querétaro)
    const datosFormateados = datos.map(d => ({
      temp: d.temp,
      hum: d.hum,
      timestamp_local: d.timestamp.toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City'
      }),
      timestamp_utc: d.timestamp
    }));

    res.json(datosFormateados);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET: Contador total
app.get('/api/telemetry/count', async (req, res) => {
  try {
    const count = await Telemetry.countDocuments();
    res.json({ total_registros: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ruta raíz (opcional, para ver que funciona)
app.get('/', (req, res) => {
  res.send(`
    <h1>ESP32 + DHT22 Telemetría</h1>
    <p><strong>Estado:</strong> API funcionando</p>
    <p><strong>Endpoint POST:</strong> <code>/api/telemetry</code></p> <p><strong>Endpoint TIME:</strong> <code>/api/update-time</code></p> <p><strong>Total registros:</strong> <span id="count">cargando...</span></p>
    <script>
      // CORREGIDO: ahora apunta a /api/telemetry/count
      fetch('/api/telemetry/count')
        .then(r => r.json())
        .then(d => {
          document.getElementById('count').textContent = d.total_registros;
        })
        .catch(e => {
          document.getElementById('count').textContent = "Error al cargar";
          console.error(e);
        });
    </script>
  `);
});

// NUEVA RUTA: Retorna un tiempo aleatorio entre 4s y 60s
app.get('/api/update-time', (req, res) => {
  try {
    const min = 4;
    const max = 60;
    // Generar entero aleatorio
    const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
    
    console.log(`Solicitud de tiempo recibida. Respondiendo: ${seconds}s`);
    res.json({ seconds: seconds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`POST → https://esp32-telemetry.onrender.com/api/telemetry`);
});