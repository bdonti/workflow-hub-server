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


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iedqjux.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    const userCollection = client.db('hrWorkFlowHubDB').collection('users');
    const taskCollection = client.db('hrWorkFlowHubDB').collection('tasks');

    //user related apis
    app.get('/users', async(req,res)=>{
      const result= await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/employee/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let employee = false;
      if (user) {
        employee = user?.role === 'employee';
      }
      res.send({ employee });
    })

    app.get('/users/hr/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let hr = false;
      if (user) {
        hr = user?.role === 'hr';
      }
      res.send({ hr });
    })

    app.get('/users/employees', async (req, res) => {
      const query = { role: 'employee' };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.put("/users/verify/:id", async(req,res) =>{
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) }, 
        { $set: { isVerified: true } }
      );
      if (result.modifiedCount === 1) {
        return res.status(200).send({ message: 'Verification status updated successfully' });
      } else {
        return res.status(404).send({ message: 'Employee not found or verification status not updated' });
      }
    })

    app.post('/users', async(req,res)=>{
        const user= req.body;
        const query = {email: user.email};
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
          return res.send({message: 'User already exists'});
        }
        const result= await userCollection.insertOne(user);
        res.send(result);
      })

    //task related apis
    app.get('/tasks', async(req,res)=>{
      const email= req.query.email;
      const query= {email: email};
      const result = await taskCollection.find(query).toArray();
      res.send(result);
  })

    app.post('/tasks', async(req,res)=>{
      const task= req.body;
      const result= await taskCollection.insertOne(task);
      res.send(result);
    })



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req,res)=>{
    res.send("Website server is running");
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`);
})