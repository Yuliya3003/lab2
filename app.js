const mysql = require('mysql2/promise');
const http = require('http');
const fs = require('fs');
const qs = require('querystring');

// Подключение к базе данных
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '3003',
  database: 'lab2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


// async function createTrigger() {
//     const checkColumnSQL = `
//         SELECT COUNT(*) AS column_exists 
//         FROM information_schema.COLUMNS 
//         WHERE TABLE_NAME = 'Positions' 
//           AND COLUMN_NAME = 'date_update' 
//           AND TABLE_SCHEMA = DATABASE();
//     `;

//     const addColumnSQL = `
//         ALTER TABLE Positions 
//         ADD COLUMN date_update DATETIME;
//     `;

//     const createTriggerSQL = `
//         CREATE TRIGGER after_update_positions
//         AFTER UPDATE ON Positions
//         FOR EACH ROW
//         BEGIN
//             SET NEW.date_update = NOW();
//         END;
//     `;

//     try {
//         const connection = await pool.getConnection();

//         // Проверка существования столбца date_update
//         const [result] = await connection.query(checkColumnSQL);
//         const columnExists = result[0].column_exists;

//         // Если столбец не существует, добавляем его
//         if (columnExists === 0) {
//             await connection.query(addColumnSQL);
//         }

//         // Удаление триггера, если он уже существует (чтобы избежать ошибок)
//         await connection.query(`DROP TRIGGER IF EXISTS after_update_positions`);

//         // Создание триггера
//         await connection.query(createTriggerSQL);

//         connection.release();
//         console.log('Триггер создан успешно.');
//     } catch (err) {
//         console.error('Ошибка создания триггера:', err);
//     }
// }

// createTrigger();

async function handleJoinRequest(req, res) {
    const { table1, table2 } = req.query;

    try {
        // Формирование SQL-запроса для объединения таблиц
        const sql = `
            SELECT t1.*, t2.*
            FROM ${mysql.escapeId(table1)} AS t1
            JOIN ${mysql.escapeId(table2)} AS t2 ON t1.position_id = t2.position_id
        `;

        const [rows] = await pool.query(sql);

        let html = '<table>';
        html += '<tr>';

        // Формирование заголовков таблицы
        if (rows.length > 0) {
            Object.keys(rows[0]).forEach(key => {
                html += `<th>${key}</th>`;
            });

            html += '</tr>';

            // Формирование строк таблицы
            rows.forEach(row => {
                html += '<tr>';
                Object.values(row).forEach(value => {
                    html += `<td>${value}</td>`;
                });
                html += '</tr>';
            });
        } else {
            html += '<tr><td colspan="100%">Нет данных для отображения</td></tr>';
        }

        html += '</table>';

        res.statusCode = 200;
        res.end(html);
    } catch (err) {
        console.error('Ошибка выполнения запроса объединения:', err);
        res.statusCode = 500;
        res.end('Ошибка сервера');
    }
}

// Обработка POST-запросов
async function reqPost(request, response) {
    if (request.method === 'POST') {
        let body = '';

        request.on('data', function (data) {
            body += data;
        });

        request.on('end', async function () {
            const post = qs.parse(body);

            if (request.url === '/add') {
                const sInsert = "INSERT INTO Positions (earth_position, sun_position, moon_position) VALUES (?, ?, ?)";
                
                try {
                    const [results] = await pool.execute(sInsert, [
                        post.earth_position,
                        post.sun_position,
                        post.moon_position
                    ]);
                    console.log('Запись успешно добавлена. ID:', results.insertId);
                    response.statusCode = 302; 
                    response.setHeader('Location', '/'); 
                    response.end();
                } catch (err) {
                    console.error('Ошибка выполнения запроса на добавление:', err);
                    response.statusCode = 500;
                    response.end('Ошибка сервера');
                }
            } else if (request.url === '/delete') {
                const sDelete = 'DELETE FROM Positions WHERE position_id = ?';
                try {
                    const [results] = await pool.execute(sDelete, [post.id]);
                    console.log('Удалено. ID:', post.id);
                    response.statusCode = 302;
                    response.setHeader('Location', '/');
                    response.end();
                } catch (err) {
                    console.error('Ошибка выполнения запроса на удаление:', err);
                    response.statusCode = 500;
                    response.end('Ошибка сервера');
                }
            } else {
                response.statusCode = 404;
                response.end('Ресурс не найден');
            }
        });
    } else {
        response.statusCode = 405;
        response.end('Метод не поддерживается');
    }
}


// Выгрузка данных таблицы Positions
async function ViewSelect(res) {
    try {
        const [columns] = await pool.query('SHOW COLUMNS FROM Positions');
        res.write('<tr>');
        for (let column of columns) {
            res.write('<th>' + column.Field + '</th>');
        }
        res.write('</tr>');

        const [rows] = await pool.query('SELECT * FROM Positions');
        for (let row of rows) {
            res.write('<tr>');
            for (let column in row) {
                res.write('<td>' + row[column] + '</td>');
            }
            res.write('</tr>');
        }
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
    }
}

async function ViewJoinTables(res, table1, table2) {
    try {
        const sql = `
            SELECT t1.*, t2.*
            FROM ${mysql.escapeId(table1)} AS t1
            JOIN ${mysql.escapeId(table2)} AS t2 ON t1.position_id = t2.position_id
        `;
        const [rows] = await pool.query(sql);

        if (rows.length > 0) {
            const columns = Object.keys(rows[0]);

            res.write('<table><tr>');
            for (let column of columns) {
                res.write('<th>' + column + '</th>');
            }
            res.write('</tr>');

            rows.forEach(row => {
                res.write('<tr>');
                columns.forEach(column => {
                    res.write('<td>' + row[column] + '</td>');
                });
                res.write('</tr>');
            });

            res.write('</table>');
        } else {
            res.write('<tr><td colspan="100%">Нет данных для отображения</td></tr>');
        }
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
        res.write('<tr><td colspan="100%">Ошибка сервера</td></tr>');
    }
}

// Версия базы данных
async function ViewVer(res) {
    try {
        const [rows] = await pool.query('SELECT VERSION() AS ver');
        res.write(rows[0].ver);
    } catch (err) {
        console.error('Ошибка выполнения запроса:', err);
    }
}

// Создание HTTP-сервера
const server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
        await reqPost(req, res);
    } else if (req.method === 'GET') {
        console.log('Loading...');

        res.statusCode = 200;

        const array = fs.readFileSync(__dirname + '/select.html').toString().split('\n');
        for (let i in array) {
            if (array[i].trim() !== '@tr' && array[i].trim() !== '@join' && array[i].trim() !== '@ver') res.write(array[i]);
            if (array[i].trim() === '@tr') await ViewSelect(res);
            if (array[i].trim() === '@join') {
                const urlParts = new URL(req.url, `http://${req.headers.host}`);
                const table1 = urlParts.searchParams.get('table1') || 'Positions';
                const table2 = urlParts.searchParams.get('table2') || 'Observations';
                await ViewJoinTables(res, table1, table2);
            }
            if (array[i].trim() === '@ver') await ViewVer(res);
        }
        res.end();
        console.log('User Done.');
    } else {
        res.statusCode = 405;
        res.end('Метод не поддерживается');
    }
});

// Запуск сервера
const hostname = '127.0.0.1';
const port = 3000;
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});