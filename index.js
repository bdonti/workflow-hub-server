const express = require('express');
const app= express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;


//middleware
const corsOption = {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'https://hr-workflow-hub.web.app', 'https://hr-workflow-hub.firebaseapp.com'],
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
    const opinionCollection = client.db('hrWorkFlowHubDB').collection('opinions');


     //jwt related apis
     app.post('/jwt', async(req , res)=>{
      const { email } = req.body;

      const user = await userCollection.findOne({ email: email });
      const role = user?.role || 'user'; 

      if (!user) {
        console.log('User not found');
        return res.status(404).send({ message: 'User not found' });
      }

      const token = jwt.sign({ email, role }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

      console.log(`Bearer ${token} with user info email: ${email} & role: ${role}`); 
      res.send({ token, email, role });
    })

      // middlewares 
      const verifyToken = (req, res, next) => {
        if (!req.headers.authorization) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
          }
          req.decoded = decoded;
          next();
        })
      }

      //verify admin
      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === 'admin';
        if (!isAdmin) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

      //verify HR
      const verifyHR = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isHR = user?.role === 'hr';
        if (!isHR) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

      //verify Employee
      const verifyEmployee = async (req, res, next) => {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isEmployee = user?.role === 'employee';
        if (!isEmployee) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      }

    //user related apis
    app.get('/users', verifyToken, async(req,res)=>{
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

    app.get('/users/employee/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let employee = false;
      if (user) {
        employee = user?.role === 'employee';
      }
      res.send({ employee });
    })

    app.get('/users/hr/:email', verifyToken,  async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let hr = false;
      if (user) {
        hr = user?.role === 'hr';
      }
      res.send({ hr });
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    app.get('/users/employees', verifyToken, verifyHR, async (req, res) => {
      const query = { role: 'employee' };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.put('/users/adjust-salary/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { newSalary } = req.body;

      const { salary } = await userCollection.findOne({ _id: new ObjectId(id) });
    
      if (parseInt(newSalary) < parseInt(salary)) {
        return res.status(400).json({ message: "Salary is lower than previously" });
      }
      
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { salary: newSalary } }
      );

      res.send(result);
    });

    app.put('/users/fire/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFired: true } }
      );
      res.send(result);
    });

    app.put('/users/make-hr/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: 'hr' } }
        );
       res.send(result);
    });


    app.put("/users/verify/:id", verifyToken, verifyHR, async(req,res) =>{
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
    app.get('/tasks', verifyToken, verifyEmployee, async(req,res)=>{
      const email= req.query.email;
      const query= {email: email};
      const result = await taskCollection.find(query).toArray();
      res.send(result);
  })

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  app.get('/tasks/details', verifyToken, verifyHR, async (req, res) => {
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

    app.post('/tasks', verifyToken, verifyEmployee, async(req,res)=>{
      const task= req.body;
      const result= await taskCollection.insertOne(task);
      res.send(result);
    })


    //opinions related apis
    app.post('/opinions', async(req,res)=>{
      const task= req.body;
      const result= await opinionCollection.insertOne(task);
      res.send(result);
    })

    app.get('/opinions', verifyToken, verifyAdmin, async(req,res)=>{
      const result= await opinionCollection.find().toArray();
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


    app.post('/payments', verifyToken, verifyHR, async (req, res) => {
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

    app.get('/allPayments', verifyToken, verifyHR, async(req, res)=>{
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })

    app.get('/payments/:email', async(req, res)=>{
      const email = req.params.email;
      const query = { employeeEmail: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })



    // await client.db("admin").command({ ping: 1 });
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