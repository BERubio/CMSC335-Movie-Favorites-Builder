const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");

// Serve static files from curr. directory for image display
app.use(express.static(path.join(__dirname, '')));

//MONGO DB:
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') }) 

const url = process.env.MONGO_CONNECTION_STRING;
//console.log("DB URI: ", uri);
const dbName = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_DB_COLLECTION;

/* Database and collection */
 const databaseAndCollection = {db: dbName , collection: collection};

const { MongoClient, ServerApiVersion } = require('mongodb');

let portNumber = 4000;

app.use(bodyParser.urlencoded({ extended: false }));

process.stdin.setEncoding("utf8");

if (process.argv.length != 2) {
    process.stdout.write(`Usage movieServer.js`);
    process.exit(1);
}

console.log(`Web server started and running at http://localhost:${portNumber}`);

const prompt = "Type stop to shutdown the server: ";

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

process.stdout.write(prompt);
process.stdin.on('readable', function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
	    const command = dataInput.trim();

	    if (command === "stop") {
            //Closing MongoDB client connection
            //console.log('Closing MongoDB client connection');
            client.close();
		    console.log("Shutting down the server");
            process.exit(0);  /* exiting */

        }else{
        /* After invalid command, maintain stdin reading */
		    console.log(`Invalid command: ${command}`);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});

/* Connecting to MongoDB */
const client = new MongoClient(url, {serverApi: ServerApiVersion.v1 });

client.connect(err =>{
    if(err){
        console.error(err);
    }
    console.log("Connected to MongoDB");
})

// import axios to interact with the IMDb APIs
const axios = require('axios');


app.get("/", (request, response) => {
    // Render the home page
    response.render('home');
});

app.get("/searchMovies", (request, response) => {
    response.render('searchMovies');
});

app.get("/processSearch", (request, response) => {
    const title = request.query.movieTitle;

    const searchResult = searchMovieTitle(title);
    if(!searchResult){
        console.log("Search Result is undefined")
    }
    searchResult.then((movies) => {
        if (movies.length > 0) {
            // Get information for the first movie only (closest result to initial search)
            const movieInfo = movies[0];
            response.render("processSearch", {
                movieTitle: movieInfo.movieTitle,
                year: movieInfo.year,
                castStars: movieInfo.castStars,
                movieCover: movieInfo.cover
            });
        } else {
            // Handle case when no movie is found
            response.status(404).send('No movie found');

        }
    }).catch((err) => {
        console.log(err);
        // Render an error page
        response.render('notFound', {movieTitle: title});
        //response.status(500).send('Error processing the search');
    });

});

// function for accessing API information
async function searchMovieTitle(title){
    try {
        // Code snippet from API page
        const options = {
            method: 'GET',
            url: 'https://imdb188.p.rapidapi.com/api/v1/searchIMDB',
            params: { query: title },
            headers: {
              'X-RapidAPI-Key': '0bc21431d3mshfb4965306e43584p1ad6a3jsnef632f937ada',
              'X-RapidAPI-Host': 'imdb188.p.rapidapi.com'
            }
        };
        
        const result = await axios.request(options);
        
       // Extract information for each movie in the search result
       const movies = result.data.data.map((movie) => {
        // Modify the image URL to specify the desired size (e.g., w500 for width 500px)
        const resizedImageUrl = movie.image.replace(/_V1_.jpg$/, '_V1_UX500.jpg');

        // each array elem. has a title, year, Stars of the cast, and the movie cover image
        return {
            movieTitle: movie.title,
            year: movie.year,
            castStars: movie.stars,
            cover: resizedImageUrl
        };
       });
       // return array of movies
       return movies;
    
    }catch(err){
        console.error(err);
        console.log("Movie Search Failed");
    }

}

app.post("/addMovie", (request, response) => {
    const { movieTitle, year, castStars, cover } = request.body;

    // Add movie information to MongoDB
    // Example: Insert into a collection named 'movies'
    const movie = {
        movieTitle: movieTitle,
        year: year,
        castStars: castStars,
        cover: cover
    };

    // Assuming you have already connected to MongoDB
    const collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
    collection.insertOne(movie)
        .then(() => {
            console.log("Movie added to MongoDB");
            // Redirect or render a confirmation page
            response.render("processAdd", { movieName: movieTitle});
        })
        .catch((error) => {
            console.error("Error adding movie to MongoDB:", error);
            // Render an error page
            response.status(500).send('Error adding movie to database');
        });
});

app.get("/reviewFavorites", (request, response) => {
     // Retrieve all movies from the MongoDB collection
     const collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
     collection.find({}).toArray()
         .then((movies) => {
             // Render a view to display the watchlist with the retrieved movies
             response.render("reviewFavorites", { movies: movies });
         })
         .catch((error) => {
             console.error("Error fetching movies from MongoDB:", error);
             // Render an error page
             response.status(500).send('Error fetching movies from database');
         });
});

app.get("/removeMovie", (request, remove) => {
    response.render("removeMovie");
});

app.post("/processRemove", (request, response) => {
    const { movieTitle } = request.body;

    // Delete the movie from the MongoDB collection
    const collection = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
    collection.deleteOne({ movieTitle: movieTitle })
        .then(() => {
            console.log("Movie removed from favorites");
            // Redirect or render a success page
            response.render("processRemove", {removedTitle: movieTitle});
        })
        .catch((error) => {
            console.error("Error removing movie from favorites:", error);
            // Render an error page
            response.status(500).send('Error removing movie from favorites');
        });
});


app.get("/removeAllMovies", (request, response) => {
    response.render('removeAllMovies');
});

app.post("/removeAllMovies", async (request, response) => { 
    try {
        const result = await client.db(dbName).collection(collection).deleteMany({});
        response.render('processRemoveAll');
    } catch (e) {
        console.error(e);
    }
});


app.listen(portNumber); 