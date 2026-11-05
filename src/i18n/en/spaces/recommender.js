export default {
  title: 'Recommendations: a space of tastes',
  summary: 'From a table of ratings by 8 viewers for 12 movies, the model finds "taste vectors" and suggests what to watch. Viewers end up next to their movies.',
  uses: 'Recommendations in streaming services, music apps, marketplaces and social media feeds.',
  resultTitle: 'Recommendations',
  movies: ['Nomad', 'John Wick', 'Tomiris', 'Home Alone', 'Kelinka Sabina', 'Business in Kazakh',
    'Kyz Zhibek', 'Forrest Gump', 'The Shawshank Redemption', 'The Lion King', 'Shrek', 'Er Tostik and the Dragon'],
  users: ['Aigerim', 'Baurzhan', 'Dinara', 'Yermek', 'Zhanar', 'Zarina', 'Dias', 'Madina'],
  viewers: 'viewers',
  genre: { action: 'action', comedy: 'comedy', drama: 'drama', animation: 'animation' },
  trained: 'Model trained: RMSE {rmse} points after 400 epochs',
  userLabel: 'What to recommend to a viewer?',
  pickUser: '— pick a viewer —',
  movieLabel: 'Similar movies',
  pickMovie: '— pick a movie —',
  liked: '{name} rated highly: {list}.',
  predictNote: 'Predicted rating = average rating ({mu}) + the dot product of the viewer\'s taste vector and the movie vector. The closer a movie is to the viewer in the space (and the more it points "the same way"), the higher the prediction.',
  similarHtml: 'Most similar to "{title}": {list}.',
  similarNote: 'Similarity is the cosine of the angle between movie vectors. The model does not know the genres: it found them on its own, from who rated what and how.',
  viewer: 'Viewer {name}',
  forecast: 'predicted {v}',
  movieInfo: 'Genre: {genre} · vector ({vec})',
  ratings: 'Ratings: {list}',
  legendHtml: `<ul class="legend">
      <li><span class="dot" style="background:#fff"></span><span><b>White dots are viewers</b>, colored ones are movies (the color is the genre, which the model does not know).</span></li>
      <li><span class="line pos"></span><span><b>Yellow lines</b> are recommendations; the label is the predicted rating.</span></li>
      <li><span class="line neg"></span><span><b>Blue lines</b> are similar movies.</span></li>
    </ul>`,
  introHtml: `<p>The ratings table is almost empty: each viewer has seen only some of the movies. The model learns to represent both viewers and movies
    as <b>vectors of three numbers</b> so that the dot product of the vectors predicts the rating. These vectors are what is drawn in 3D.
    Training (400 epochs of gradient descent) ran when the page opened.</p>`,
  tableTitle: 'Ratings table',
  tableNote: 'A dot means the movie was not watched. The model\'s job is to fill in these gaps.',
};
