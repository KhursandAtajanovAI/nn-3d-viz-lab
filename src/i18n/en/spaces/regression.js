export default {
  title: 'Regression: predicting an apartment price',
  summary: 'A 4 → 8 → 1 network learns from 400 examples to estimate an apartment price from its area, number of rooms, distance to the city center and building age. Prices are in millions of tenge.',
  uses: 'Valuing real estate and cars, forecasting demand and sales, estimating delivery time, credit scoring.',
  f: { area: 'Area', rooms: 'Rooms', dist: 'To city center', age: 'Building age' },
  u: { area: 'm²', dist: 'km', age: 'yrs' },
  apt: [
    'Studio 28 m², 1 room, 18 km, 5 yrs',
    'Two-room 54 m², 2 rooms, 9 km, 30 yrs',
    'Three-room 78 m², 3 rooms, 4 km, 50 yrs',
    'Penthouse 140 m², 5 rooms, 2 km, 3 yrs',
    'Old "Khrushchyovka" 44 m², 2 rooms, 22 km, 60 yrs',
  ],
  money: '{v}M ₸',
  outName: 'Price, M ₸',
  randomNote: 'Random input: the normalized features are drawn at random from [−1, 1] — this is not a real apartment but an arbitrary point. It shows that the network outputs a number for any input; the error relative to the formula can be large here.',
  rawUnitsHtml: 'In original units: <b>{v}</b>',
  inTengeHtml: 'In tenge: <b>≈ {v}</b>',
  truthHtml: 'By the formula the data was generated from, the price is ≈ <b>{v}</b> — the network is off by {err}%. The output neuron is linear (no activation function): regression outputs any number, not a probability.',
  normNote: 'The numbers in the input layer are normalized features: (value − mean) / spread. The output price is normalized too and converted back to millions of tenge.',
  lossTitle: 'Error (MSE) during training — in normalized units',
  epoch: 'epoch',
  mseNorm: 'MSE (norm.)',
  finalLoss: 'Final error {loss} in normalized units ≈ ±{v} on average.',
  introHtml: `<p>Regression means predicting a <b>number</b>, not a class. The network trained when the page opened on 400 synthetic apartments
    (120 epochs of gradient descent). Prices are in millions of tenge, at the level of Astana and Almaty: from ~25M ₸ for a studio on the outskirts to 120M+ ₸ for a penthouse downtown. Pick an apartment under "Input data" and run the forward pass.</p>`,
  tryTitle: 'What to try',
  tryHtml: `<ul class="steps">
          <li>Compare the "Studio" and the "Penthouse": hover over the hidden neurons — which react to the area and which to the distance?</li>
          <li>Hover over an "Area → hidden neuron" connection: important features have larger weights in absolute value.</li>
          <li>Pick "Random input" — a random point in the space of normalized features.</li>
        </ul>`,
};
