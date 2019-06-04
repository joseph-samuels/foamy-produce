const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', { useMongoClient: true } )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())
var Schema = mongoose.Schema;

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
// Random ID Function
function makeid(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
function utcdate(d) {
  let m = new Date(d);
  let  shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let shortDays = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
  let paddate = m.getDate();
  if (paddate < 10 ) paddate = '0' + paddate;
  return shortDays[m.getDay()] + ' ' + shortMonths[m.getMonth()] + ' ' + paddate + ' ' + m.getFullYear()
}

// The models
// --- The users document schema for the database
var usersSchema = new Schema({
  _id:  { type: String, required: true },
  username: { type: String, required: true }
});
var Users = mongoose.model('Users', usersSchema);
 
// --- The exams document schema for the database
var examsSchema = new Schema({
  userId: { type: String, required: true },
  description: String,
  duration: Number,
  date: Date
});
var Exams = mongoose.model('Exams', examsSchema);


// Get the user, post from /api/exercise/new-user
app.post('/api/exercise/new-user', function (req, res) {
  let p = req.body
  let user = new Users({ _id: makeid(9), username: p.username });
  user.save((err, data) => {
    if (err) return console.error(err);
    res.json({ 'username': data.username, '_id': data.id });
  });   
})
// Get the exam, post from /api/exercise/add
app.post('/api/exercise/add', function (req, res) {
  let p = req.body
  // log data to database
  Users.findOne({ _id: p.userId }, function (err, data) {
    if (err) return res.status(400).send(err.message);
    if (data != null) {
      let Username = data.username;
      let thedate = p.date
      if (thedate === '') thedate = new Date();

      let exam = new Exams({ 'userId': p.userId, 'description': p.description, 'duration': p.duration, 'date': thedate });
      exam.save((err, data) => {
        if (err) return res.status(400).send(err.message);
        let thed = utcdate(data.date);
        res.json({ 'username': Username, 'description': data.description, 'duration': data.duration, '_id': data.userId, 'date': thed });
      });
    } else {
      res.status(400).send('unknown _id');
    }
  }) 
})
// Users
app.get('/api/exercise/users', function (req, res) {
  Users.find({}, function (err, data) {
    if (err) return res.status(400).send(err.message);
    if (data != null) {
      res.json(data);
    } else {
      res.status(400).send('no data');
    }
  }) 
})
// Reports
app.get('/api/exercise/log', function (req, res) {
  let exams = req.query
  let apiQuiery = {}; 
  let qLimit = 10000;
  if (exams.hasOwnProperty('userId')) {
    apiQuiery.userId = exams.userId;
  }

  if (exams.hasOwnProperty('from')) {
    if(!isNaN(Date.parse(exams.from))) {
      apiQuiery.date = {}
      apiQuiery.date.$gte = exams.from;
    } 
  } 
  if (exams.hasOwnProperty('to')) {
    if (!isNaN(Date.parse(exams.to))) {
      if (!exams.hasOwnProperty('date')) apiQuiery.date = {}
      apiQuiery.date.$lte = exams.to;
    }  
  }
  if (exams.hasOwnProperty('limit')) {
    qLimit = parseInt(exams.limit);
  }

  Users.findOne({ _id: exams.userId }, function (err, data) {
    if (err) return console.error(err);
    if (data != null) {
      let username = data.Username;
      Exams.find((apiQuiery), function (err, data) {
        if (err) return console.error(err);
        if (data != null) {
          let response = { _id: exams.userId, username: username, count: data.length, log:[] }
          data.forEach( function (doc) {
            let thed = utcdate(doc.date);
            response.log.push({ description: doc.description, duration: doc.duration, date: thed });
          });
          res.json(response);
        }
      }).limit(qLimit); 
    } else {
      // did not find user
      res.status(400).send('unknown userId');
    }
  })
})
// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found.'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
