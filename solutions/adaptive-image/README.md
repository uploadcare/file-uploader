# Adaptive Image

<script src="./index.js" type="module"></script>

<uc-img width="100%" src="https://uploadcare.github.io/uc-blocks/assets/media/kitten.jpg?absolute"> </uc-img>

<uc-live-html>
  <script src="./index.js" type="module"></script>

  <style>
    uc-img {
      --uc-img-pubkey: '364c0864158c27472ffe';
      display: contents;
    }

    uc-img > img {
      transition: 1s;
    }

    uc-img > img[unresolved] {
      opacity: 0;
      transform: scale(0.8);
    }
  </style>

</uc-live-html>
