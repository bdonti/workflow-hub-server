const express = require('express');
const app= express();
const cors = require('cors');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const paymentCollection = client.db('hrWorkFlowHubDB').collection('payments');

    //user related apis
    app.get('/users', async(req,res)=>{
      const result= await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/all-employees', async (req, res) => {
      const query = {
        $or: [
          { role: 'employee', isVerified: true },
          { role: 'hr' }
        ],
        role: { $ne: 'admin' }
      };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

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

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
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

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  app.get('/tasks/details', async (req, res) => {
    const { name, month } = req.query;
    const query = {};
  
    if (name) {
      query.name = name;
    }
  
    if (month) {
    
    }
  
    const tasks = await taskCollection.find(query).toArray();
    
    const filteredTasks = month
      ? tasks.filter(task => {
          const taskDate = new Date(task.date);
          return monthNames[taskDate.getUTCMonth()].toLowerCase() === month.toLowerCase();
        })
      : tasks;
      
    const result = filteredTasks.map(task => {
      const taskDate = new Date(task.date);
      const monthName = monthNames[taskDate.getUTCMonth()];
      return { ...task, monthName };
    });
    
    res.send(result);
  });

    app.post('/tasks', async(req,res)=>{
      const task= req.body;
      const result= await taskCollection.insertOne(task);
      res.send(result);
    })


    //payment Apis
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });


    app.post('/payments', async (req, res) => {
      const payment = req.body;
      
      const existingPayment = await paymentCollection.findOne({
        employeeEmail: payment.employeeEmail,
        month: payment.month,
        year: payment.year
      });
      
      if (existingPayment) {
        return res.status(400).json({ message: 'Salary already paid for this month and year' });
      } else {
        const result = await paymentCollection.insertOne(payment);
        console.log('payment info', payment);
        return res.status(200).json(result);
      }
    });

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      let limit = parseInt(req.query.limit) || 5;
      let offset = parseInt(req.query.offset) || 0; 
    
      if (limit < 1 || offset < 0) {
        return res.status(400).send({ error: "Please Correct the limit" });
      }
    
      const query = { employeeEmail: email };
    
        const totalCount = await paymentCollection.countDocuments(query);
    
        const result = await paymentCollection
          .find(query)
          .sort({ year: -1, month: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();
    
        res.send({ totalCount, payments: result });
  });

    app.get('/payments/:email', async(req, res)=>{
      const email = req.params.email;
      const query = { employeeEmail: email };
      const result = await paymentCollection.find(query).toArray();
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