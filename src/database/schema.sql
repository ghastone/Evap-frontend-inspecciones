-- =======================================================
-- 1. TABLAS DE CONFIGURACIÓN Y MAESTROS
-- =======================================================

CREATE TABLE exportadoras (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE variedades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE huertos (
    id SERIAL PRIMARY KEY,
    exportadora_id INT NOT NULL,
    productor VARCHAR(150) NOT NULL,
    nombre_huerto VARCHAR(150) NOT NULL,
    csg VARCHAR(50) NOT NULL UNIQUE,
    FOREIGN KEY (exportadora_id) REFERENCES exportadoras(id) ON DELETE CASCADE
);

-- Tablas para los límites configurables
CREATE TABLE parametros_calidad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    limite_ab DECIMAL(5,2) NOT NULL,
    limite_bc DECIMAL(5,2) NOT NULL,
    es_sumatoria BOOLEAN DEFAULT FALSE
);

CREATE TABLE parametros_condicion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    limite_12 DECIMAL(5,2) NOT NULL,
    limite_23 DECIMAL(5,2) NOT NULL,
    es_sumatoria BOOLEAN DEFAULT FALSE
);

-- =======================================================
-- 2. TABLAS TRANSACCIONALES (LA INSPECCIÓN)
-- =======================================================

-- El encabezado de la inspección
CREATE TABLE procesos (
    id SERIAL PRIMARY KEY,
    numero_proceso VARCHAR(50) NOT NULL UNIQUE,
    fecha_inspeccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    huerto_id INT NOT NULL,
    variedad_id INT NOT NULL,
    
    -- Totales y Resultados calculados al finalizar
    cajas_evaluadas INT DEFAULT 0,
    pct_exportable DECIMAL(5,2),
    pct_calidad DECIMAL(5,2),
    pct_condicion DECIMAL(5,2),
    calificacion_final VARCHAR(2), -- Ej: 'A2', 'C3'
    estado VARCHAR(20),            -- 'Aprobado', 'Objetado'
    
    FOREIGN KEY (huerto_id) REFERENCES huertos(id),
    FOREIGN KEY (variedad_id) REFERENCES variedades(id)
);

-- Cada caja evaluada dentro de un proceso
CREATE TABLE cajas_evaluadas (
    id SERIAL PRIMARY KEY,
    proceso_id INT NOT NULL,
    numero_caja INT NOT NULL,      -- Correlativo dentro del proceso (1, 2, 3...)
    num_frutos INT NOT NULL,       -- Tamaño de la muestra
    color_embalaje VARCHAR(20),    -- 'Light' o 'Dark'
    brix DECIMAL(4,1),             -- Grados Brix
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (proceso_id) REFERENCES procesos(id) ON DELETE CASCADE
);

-- Los defectos encontrados por cada caja
CREATE TABLE caja_defectos (
    id SERIAL PRIMARY KEY,
    caja_id INT NOT NULL,
    tipo_defecto VARCHAR(20) NOT NULL, -- 'calidad' o 'condicion'
    nombre_defecto VARCHAR(100) NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    
    FOREIGN KEY (caja_id) REFERENCES cajas_evaluadas(id) ON DELETE CASCADE
);

-- =======================================================
-- 3. INSERCIÓN DE DATOS INICIALES (Tus datos actuales)
-- =======================================================

INSERT INTO exportadoras (nombre) VALUES 
('Exportadora Gold Anda'), 
('Exportadora Fu Chan');

INSERT INTO variedades (nombre) VALUES 
('Lapins'), ('Santina'), ('Bing'), ('Sweetheart');

INSERT INTO huertos (exportadora_id, productor, nombre_huerto, csg) VALUES 
(1, 'AGRIC Y COM LAS ARAUCARIAS LTDA', 'AGRICOLA Y COMERCIAL LAS ARAUCARIAS', '98901'),
(1, 'AGRICOLA FRUTAS DEL SUR SPA', 'SAN CLEMENTE', '3130802'),
(2, 'MARIA VERONICA FLORES MUÑOZ', 'MARIA VERONICA FLORES MUÑOZ', '120497');

INSERT INTO parametros_calidad (nombre, limite_ab, limite_bc, es_sumatoria) VALUES 
('Frutos deformes / dobles', 3.0, 6.0, FALSE),
('Russet', 6.0, 15.0, FALSE),
('Fruta sin pedicelo', 8.0, 16.0, FALSE),
('Falta de color', 10.0, 20.0, FALSE),
('Sumatoria de calidad', 15.0, 20.0, TRUE);

INSERT INTO parametros_condicion (nombre, limite_12, limite_23, es_sumatoria) VALUES 
('Pudrición', 0.01, 0.4, FALSE),
('Partiduras laterales', 2.0, 5.0, FALSE),
('Machucones', 2.0, 5.0, FALSE),
('Sumatoria condición', 10.0, 15.0, TRUE);