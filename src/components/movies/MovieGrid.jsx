import MovieCard from '././MovieCard.jsx'

const MovieGrid = () => {
    const buttons = [
        "Action", "romance", "Comedy", "Horror", "Adventure", "Sci-fi", "Drama", "Thriller"
    ]
    return(
        <section>
            <div>
                <h2>Trending Now</h2>
            </div>
                <MovieCard
                 
                />
                <div>
                    <h2>Top Rated Movies</h2>
                </div>
                <MovieCard
               
                />
                <div>
                    <h2>Browse by Genre</h2>
                    <p>Discover movies tailored to your taste</p>
                    {buttons.map((buttons, index) =>{
                         return <button key={index}>{buttons}</button>
                    })}
                </div>
                <div>
                    <h2>Recently Added</h2>
                </div>
                <MovieCard
                
                />
        </section>
    );
};

export default MovieGrid;