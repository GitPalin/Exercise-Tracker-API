const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require('shortid');
const moment = require("moment");
 
const cors = require('cors')

const mongoose = require('mongoose')
//MLAB, not MONGOLAB this time
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track')  

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


// app.use(express.static('public'))
app.use(express.static(__dirname + "/public"));  

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});
//testing shortid
// console.log(shortid.generate());

//testing mongo
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("we're connected!");
});

var userSchema = new mongoose.Schema({
    shortId: {type: String, unique: true, default: shortid.generate},
    name: String,
  
    exercises: [
        {
          description: String,
          duration: Number,
          // note that dates must be modified with mongoose methods: https://mongoosejs.com/docs/schematypes.html#dates
          date: { 
            type: Date,
            default: Date.now
            }
        }
                ]
      }, { usePushEach: true }
                              );

var User = mongoose.model("User", userSchema);

// schema for data referencing, i chose a simpler way for this little project
// const exerciseSchema = new mongoose.Schema({
//     _creator: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//     },
//     description: String,
//     duration: String,
//   // note that dates must be modified with mongoose methods: https://mongoosejs.com/docs/schematypes.html#dates
//     date: { 
        //   type: Date,
        //   default: Date.now
        // }
//     });

// const Exercise = mongoose.model('Exercise', exerciseSchema);


// Not found middleware
// app.use((req, res, next) => {
//   return next({status: 404, message: 'not found'})
// })

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

// User Story: I can create a user by posting form data username to /api/exercise/new-user and returned will be an object with username and _id.
app.post('/api/exercise/new-user', function(req, res){
  console.log("reached user post route");
  let newUser = req.body.username
  // console.log("username:" + newUser);
// create saves the user to db, too
   User.create({name: newUser}, function(err, newUser){
              if(err){
                  console.log(err);
              } else {
                  console.log("created new user:" + newUser)
                  res.json({username:newUser.name, _id:newUser.shortId})
              }
          });
});

//Get all users, show id and name
app.get("/api/exercise/users", function(req, res){
      User.find({}, "name").exec(function(err, foundUser) {
        if(err){ 
          return console.log(err);
        }else{
          console.log("The user and id are " + foundUser)
           res.json(foundUser)
          }
      })  
    // res.json(userList);
    // res.json(userList.toString());
    // userList.forEach(function(user){
    //   {username: user.name}{_id: user.id}
    // })
});
//
//POst-route to add new exercise
app.post('/api/exercise/add', function(req, res){
  
  console.log("reached exercise post route");
  let desc = req.body.description
  let dur = req.body.duration
  // default date set to schema
  //use momentjs to set date
  let setDate =  moment(req.body.date).isValid() ? moment(req.body.date) : Date(req.body.date)
    console.log(setDate);
  let wantedUserId = req.body.userId
  let addExercise = {"description":desc, "duration":dur, "date":setDate};
  // console.log("addExercise:" + addExercise.description)
  // let userId = 
  User.findOne({shortId:wantedUserId}).populate("exercises").exec( function(err, foundUser) {
      if(err){ 
        return console.log(err);
      }else{
     // foundUser.exercises.concat([addExercise]);  //not working
        foundUser.exercises.push(addExercise); //working after adding usePushEach: true to schema
          foundUser.save(function(err, data){
            if(err){
              console.log(err)
            }else{
             // console.log("users exercises:" + foundUser.exercises)
             res.json({"exercise": addExercise.description, "time": addExercise.date});    
                 }            
          });
        }
    });
  //alternate way, to create an exercise, find user, push to users array and save user
  // let userId = req.body.userId
    // console.log("userId:" + userId)
// push execise to users array???
  //how to link creator, userid is shortid?
  // Exercise.create({description:desc, duration:dur, date:setDate, _creator:userId}, function(err, exercise){
  //      if(err){
  //        console.log(err)
  //      }else{
  //         User.findById(userId, function (err, foundUser) {
  //           if (err){
  //             console.log(err)
  //           }else{
  //             console.log("found user:" + foundUser)
  //               // note, concat the id of exercise, because the array in userSchema is for id:s not whole exercise data 
  //             //note, push used to work, now it's concat, or error appears with mongo api (fix found)
  //              foundUser.exercises = foundUser.exercises.concat([exercise._id])
  // // alternate way:
  // //  foundUser.description = desc;
  // // foundUser.duration = dur;
  // // foundUser.date = setDate;
  //             foundUser.save(function(err, foundUser){
  //                 if(err){
  //                   console.log(err)
  //                 }else{
  //                  console.log("saved exercise" + foundUser)
  //                 res.json({"exercise": foundUser.exercises.description, "time": foundUser.exercises.date});    
  //               // res.json({"exercise": exercise.description, "time": exercise.date});
  //                 }            
  //               });
  //           }
  //         });
  //       }
  // });
});

// I can retrieve a full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). Return will be the user object with added array log and count (total exercise count).
// I can retrieve part of the log of any user by also passing along optional parameters of from & to or limit. (Date format yyyy-mm-dd, limit = int)
  // https://expressjs.com/en/api.html#req.query  
app.get("/api/exercise/log", function(req, res){
  // You can use the req.query property to extract values from a url that has a query string. https://expressjs.com/en/api.html#req.query
  // check date formats and res.json error if format is wrong
  let checkDate = function(check){
     let result = moment(check, "YYYY-MM-DD", true).isValid()
    return result
  }
  //if parameters exist but are wrong format, show format hint
  if(req.query.from && !checkDate(req.query.from)) res.json({"parameter 'from' wrong, correct format": "YYYY-MM-DD"})
  if(req.query.to && !checkDate(req.query.to)) res.json({"parameter 'to' wrong, correct format": "YYYY-MM-DD"})
     
  let fromDate = moment(req.query.from)
  let toDate   = moment(req.query.to)
  //check if date format is correct
  console.log(toDate)
  
  // console.log("datecheck:"+checkDate(req.query.from))
  User.findOne({shortId:req.query.id}, "name").populate("exercises").exec(function(err, foundUser) {
    // let fromDate =
    if(err){ 
      return console.log(err);
    }else{
      // sort and filter/select exercises between user-defined timepoints
      let filteredExercises = foundUser.exercises.sort("date").filter(function(exer){
        
        let exerciseDate = moment(exer.date)
        // console.log(exerciseDate)
        
          if(req.query.from && req.query.to){
            return exerciseDate >= fromDate && exerciseDate <= toDate
            }else if(req.query.from){
              return exerciseDate >= fromDate
              }else if(req.query.to){
              return exerciseDate <= toDate
                }else{
                   return true
              }                  
      })
      //splice to limit logged exercises
     let splicedExercises = filteredExercises.splice(req.query.limit);

       res.json({"total exercise count:":foundUser.exercises.length, name:foundUser.name, id:req.query.id, exercises:filteredExercises})
      }
  })
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
