export default {
  title: 'MobileNet: a network for phones (2017)',
  fidelityNote: 'The MobileNet v1 architecture is exact; the answer is a demonstration.',
  summary: 'Nearly as accurate as VGG, but with 30 times fewer weights (4.2M) and dozens of times less computation — thanks to depthwise separable convolutions.',
  uses: 'Recognition on smartphones and cameras: portrait mode, plant and product recognition, AR filters, smart doorbells.',
  l: {
    input: 'Input 224×224',
    conv: 'Conv 3×3, stride 2',
    dw: 'DW block',
    dws: 'DW blocks',
  },
  n: {
    dw: 'Depthwise 3×3 (each channel separately) + pointwise 1×1 (mixing the channels).',
  },
  paramsNote: 'the row sum is approximate: the table leaves out the batch normalization parameters after the convolutions',
  introHtml: `<p>An ordinary 3×3 convolution from 256 channels to 256 channels has 590 thousand weights. MobileNet splits it in two:
    <b>depthwise</b> (a 3×3 filter for each channel separately, 2.3K weights) and <b>pointwise</b> 1×1 (mixing the channels, 66K).
    Altogether that is 8–9 times fewer weights and computations with almost no loss in quality.</p>`,
  tradeTitle: 'The accuracy–speed trade-off',
  tradeHtml: `<p>MobileNet has "knobs" — a width multiplier (how many channels) and the input resolution. Turning them down gives a network for any phone.
      This idea evolved into MobileNet v2/v3 and EfficientNet, which run right inside cameras and browsers.</p>`,
};
