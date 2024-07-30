const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/upload', (req, res) => {
    const num_images = req.body.num_images;
    res.render('upload', { num_images: num_images });
});

app.post('/compare', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const groundtruth = req.files.groundtruth;
    const groundtruthFilename = 'groundtruth.png';
    groundtruth.mv(path.join(__dirname, 'public/uploads', groundtruthFilename), (err) => {
        if (err) return res.status(500).send(err);
    });

    const images = [];
    for (let i = 1; i <= req.body.num_images; i++) {
        const image = req.files[`image${i}`];
        const imageName = req.body[`image${i}_name`];
        const filename = `${imageName}.png`;
        image.mv(path.join(__dirname, 'public/uploads', filename), (err) => {
            if (err) return res.status(500).send(err);
        });
        images.push(filename);
    }

    res.render('compare', { groundtruth: groundtruthFilename, images: images });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
