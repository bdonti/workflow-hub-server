const express = require('express');
const app= express();
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;


//middleware
const corsOption = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  Credential: true,
  optionSuccessStatus: 200
}
app.use(cors(corsOption));
app.use(express.json());


app.get('/', (req,res)=>{
    res.send("Website server is running");
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})