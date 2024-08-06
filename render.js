const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const express = require('express');

const app = express();
app.set('view engine', 'ejs');

// Chemin vers vos templates EJS
const templates = [
    { template: 'index', output: 'public/index.html' },
    { template: 'compare', output: 'public/compare.html' },
    { template: 'upload', output: 'public/upload.html' }
];

// Fonction pour rendre les templates en HTML statique
function renderTemplates() {
    templates.forEach(({ template, output }) => {
        ejs.renderFile(path.join(__dirname, 'views', `${template}.ejs`), {}, (err, html) => {
            if (err) {
                console.error(`Erreur lors du rendu de ${template}:`, err);
            } else {
                fs.writeFileSync(path.join(__dirname, output), html);
                console.log(`${template}.ejs rendu en ${output}`);
            }
        });
    });
}

renderTemplates();
