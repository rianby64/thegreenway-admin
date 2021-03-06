import express, { Router } from 'express';
import bodyParser from 'body-parser';
import { initializeApp, credential, firestore } from 'firebase-admin';
import './fire-keys.json';

const app = express();
const key = require('./fire-keys.json');
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

initializeApp({
  credential: credential.cert(key),
  // databaseURL: 'https://thegreenway-f50d0.firebaseio.com',
});

const db = firestore();

async function getRoutes(db: FirebaseFirestore.Firestore) {
  const routesRef = await db.collection('routes').get();
  const routes = await Promise.all(
    routesRef.docs.map(async (routeRef) => {
      const categoriesRef = (await routeRef.get(
        'categories'
      )) as FirebaseFirestore.DocumentReference[];
      const dotsRef = (await routeRef.get(
        'dots'
      )) as FirebaseFirestore.DocumentReference[];
      const images = (await routeRef.get('images')) as String[];
      const lines = (await routeRef.get(
        'lines'
      )) as FirebaseFirestore.GeoPoint[];
      const typesRef = (await routeRef.get(
        'types'
      )) as FirebaseFirestore.DocumentReference[];
      const districtsRef = (await routeRef.get(
        'districts'
      )) as FirebaseFirestore.DocumentReference[];
      const difficultyRef = (await routeRef.get(
        'difficulty'
      )) as FirebaseFirestore.DocumentReference;

      return {
        id: routeRef.id,
        animals: routeRef.get('animals') as Boolean,
        approved: routeRef.get('approved') as Boolean,
        categories: categoriesRef
          ? await Promise.all(
              categoriesRef.map(async (categoryRef) => {
                const category = await categoryRef.get();
                return {
                  title: category.get('title') as String,
                  id: category.id,
                };
              })
            )
          : [],
        children: routeRef.get('children') as Boolean,
        description: routeRef.get('description') as String,
        difficulty: (await difficultyRef.get()).id,
        // ? {
        //     [difficultyRef.id]: {
        //       title: (await difficultyRef.get()).get('title') as String,
        //     },
        //   }
        // : {},
        visuallyImpaired: routeRef.get('visuallyImpaired') as Boolean,
        wheelchair: routeRef.get('wheelchair') as Boolean,
        dots: dotsRef
          ? await Promise.all(
              dotsRef.map(async (dotRef) => {
                const dot = await dotRef.get();
                const pos = dot.get('position') as FirebaseFirestore.GeoPoint;
                const dottypeRef = (await dot.get(
                  'type'
                )) as FirebaseFirestore.DocumentReference;
                let dottypeId = '';
                let dottypeTitle = '';
                if (dottypeRef) {
                  const dottype = await dottypeRef.get();
                  dottypeId = dottype.id;
                  dottypeTitle = dottype.get('title');
                }
                return {
                  id: dotRef.id,
                  description: await dot.get('description'),
                  position: {
                    lat: pos.latitude,
                    lng: pos.longitude,
                  },
                  type: dottypeId,
                  title: await dot.get('title'),
                };
              })
            )
          : [],
        images,
        durations: routeRef.get('durations'),
        lines: lines.map((line) => {
          return { lat: line.latitude, lng: line.longitude };
        }),
        distance: routeRef.get('distance') as Number,
        minutes: routeRef.get('minutes') as Number,
        title: routeRef.get('title') as String,
        types: typesRef
          ? await Promise.all(
              typesRef.map(async (typeRef) => {
                const type = await typeRef.get();
                return {
                  title: type.get('title') as String,
                  id: type.id,
                };
              })
            )
          : [],
        districts: districtsRef
          ? await Promise.all(
              districtsRef.map(async (districtRef) => {
                const district = await districtRef.get();
                return {
                  title: district.get('title') as String,
                  id: district.id as String,
                };
              })
            )
          : [],
      };
    })
  );

  return routes;
}

app.get('/api/routes', async function (req, res) {
  try {
    const routes = await getRoutes(db);
    res.json(routes);
  } catch (e) {
    res.status(500).json(e); // THIS IS AN ERROR!!! MAKE SURE YOU WONT EXPOSE SENSTIVE INFO HERE
  }
});

app.put('/api/routes/:id/lines', async function (req, res) {
  const id = req.params.id;
  const lines = (req.body as { lat: number; lng: number }[]).map((line) => {
    return new firestore.GeoPoint(line.lat, line.lng);
  });
  try {
    await db.collection('routes').doc(id).update({ lines: lines });
    res.json({
      success: true,
    });
  } catch (e) {
    res.status(500).json(e); // THIS IS AN ERROR!!! MAKE SURE YOU WONT EXPOSE SENSTIVE INFO HERE
  }
});

app.put('/api/routes/:id', async function (req, res) {
  const id = req.params.id;
  const routeTypesRefs = await db.collection('travel_types').get();
  const routeCategoriesRefs = await db.collection('categories').get();
  const routeDifficultyRefs = await db.collection('difficulties').get();
  const districtsRefs = await db.collection('districts').get();
  let difficultyRef: firestore.DocumentData = firestore.DocumentReference;
  routeDifficultyRefs.docs.map((el) => {
    if (el.id === req.body.difficulty) {
      difficultyRef = el.ref;
    }
  });

  let arrayOfCategoriesRef: Array<firestore.DocumentData> = [];
  req.body.categories.map((el: any) => {
    routeCategoriesRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfCategoriesRef.push(elToFind.ref);
      }
    });
  });

  let arrayOfDistrictsRef: Array<firestore.DocumentData> = [];
  req.body.districts.map((el: any) => {
    districtsRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfDistrictsRef.push(elToFind.ref);
      }
    });
  });

  let arrayOfTypeRef: Array<firestore.DocumentData> = [];
  req.body.type.map((el: any) => {
    routeTypesRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfTypeRef.push(elToFind.ref);
      }
    });
  });

  let ObjectOfDurations: any = {};
  req.body.durations.forEach((el: any) => {
    ObjectOfDurations[el.name] = parseInt(el.number);
  });

  const rowToUpdate: {
    id?: string;
    animals?: boolean;
    approved?: boolean;
    children?: boolean;
    wheelchair?: boolean;
    visuallyImpaired?: boolean;
    distance?: number;
    minutes?: number;
    title?: string;
    description?: string;
    types?: Array<firestore.DocumentData>;
    categories?: Array<firestore.DocumentData>;
    districts?: Array<firestore.DocumentData>;
    durations?: Object;
    difficulty?: firestore.DocumentData;
  } = {
    animals: !!req.body.animals,
    approved: !!req.body.approved,
    children: !!req.body.children,
    wheelchair: !!req.body.wheelChair,
    visuallyImpaired: !!req.body.visuallyImpaired,
    distance: Number(req.body.distance),
    minutes: Number(req.body.minutes),
    title: req.body.title,
    description: req.body.description,
    types: arrayOfTypeRef,
    categories: arrayOfCategoriesRef,
    districts: arrayOfDistrictsRef,
    durations: ObjectOfDurations,
    difficulty: difficultyRef,
  };
  delete rowToUpdate.id;

  try {
    await db.collection('routes').doc(id).update(rowToUpdate);
    res.json({
      success: true,
    });
  } catch (e) {
    res.status(500).json(e);
  }
});

app.post('/api/routes', async function (req, res) {
  const routeTypesRefs = await db.collection('travel_types').get();
  const routeCategoriesRefs = await db.collection('categories').get();
  const routeDifficultyRefs = await db.collection('difficulties').get();
  const districtsRefs = await db.collection('districts').get();
  let difficultyRef: firestore.DocumentData = firestore.DocumentReference;
  routeDifficultyRefs.docs.map((el) => {
    if (el.id === req.body.difficulty) {
      difficultyRef = el.ref;
    }
  });
  let arrayOfCategoriesRef: Array<firestore.DocumentData> = [];
  req.body.categories.map((el: any) => {
    routeCategoriesRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfCategoriesRef.push(elToFind.ref);
      }
    });
  });

  let arrayOfDistrictsRef: Array<firestore.DocumentData> = [];
  req.body.districts.map((el: any) => {
    districtsRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfDistrictsRef.push(elToFind.ref);
      }
    });
  });

  let arrayOfTypeRef: Array<firestore.DocumentData> = [];
  req.body.type.map((el: any) => {
    routeTypesRefs.docs.map((elToFind) => {
      if (elToFind.id === el) {
        arrayOfTypeRef.push(elToFind.ref);
      }
    });
  });
  let ObjectOfDurations: any = {};
  req.body.durations.forEach((el: any) => {
    ObjectOfDurations[el.name] = parseInt(el.number);
  });
  const rowToSave: {
    animals?: boolean;
    approved?: boolean;
    children?: boolean;
    wheelchair?: boolean;
    visuallyImpaired?: boolean;
    distance?: number;
    minutes?: number;
    title?: string;
    description?: string;
    types?: Array<firestore.DocumentData>;
    categories?: Array<firestore.DocumentData>;
    districts?: Array<firestore.DocumentData>;
    durations?: Object;
    difficulty?: firestore.DocumentData;
  } = {
    animals: !!req.body.animals,
    approved: !!req.body.approved,
    children: !!req.body.children,
    wheelchair: !!req.body.wheelChair,
    visuallyImpaired: !!req.body.visuallyImpaired,
    distance: Number(req.body.distance),
    minutes: Number(req.body.minutes),
    title: req.body.title,
    description: req.body.description,
    types: arrayOfTypeRef,
    categories: arrayOfCategoriesRef,
    districts: arrayOfDistrictsRef,
    durations: ObjectOfDurations,
    difficulty: difficultyRef,
  };
  try {
    const id = db.collection('routes').doc().id;
    await db.collection('routes').doc(id).create(rowToSave);
    res.json({
      success: true,
      id: id,
    });
  } catch (e) {
    res.status(500).json({
      message: 'Backend error',
    });
  }
});

app.get('/api/dot_types', async function (req, res) {
  const dotTypeRefs = await db.collection('dot_types').get();
  res.json(
    dotTypeRefs.docs.map((dotTypeRef) => {
      const title = dotTypeRef.get('title');
      return {
        id: dotTypeRef.id,
        title,
      };
    })
  );
});

app.get('/api/districts', async function (req, res) {
  const districtsRefs = await db.collection('districts').get();
  res.json(
    districtsRefs.docs.map((districtRef) => {
      const title = districtRef.get('title');
      return {
        id: districtRef.id,
        title,
      };
    })
  );
});

app.get('/api/route_categories', async function (req, res) {
  const routeTypeRefs = await db.collection('categories').get();
  res.json(
    routeTypeRefs.docs.map((routeTypeRef) => {
      const title = routeTypeRef.get('title');
      return {
        id: routeTypeRef.id,
        title,
      };
    })
  );
});

app.get('/api/route_difficulties', async function (req, res) {
  const routeTypeRefs = await db.collection('difficulties').get();
  res.json(
    routeTypeRefs.docs.map((routeTypeRef) => {
      const title = routeTypeRef.get('title');
      return {
        id: routeTypeRef.id,
        title,
      };
    })
  );
});

app.get('/api/route_types', async function (req, res) {
  const routeTypeRefs = await db.collection('travel_types').get();
  res.json(
    routeTypeRefs.docs.map((routeTypeRef) => {
      const title = routeTypeRef.get('title');
      return {
        id: routeTypeRef.id,
        title,
      };
    })
  );
});

app.put('/api/routes/:id/dots', async function (req, res) {
  const id = req.params.id;
  const routeRef = await db.collection('routes').doc(id).get();
  const dotRefs = (await routeRef.get(
    'dots'
  )) as FirebaseFirestore.DocumentReference[];

  const dotsFromRequest = req.body as {
    [id: string]: {
      id: string;
      description: string;
      position: {
        lat: number;
        lng: number;
      };
      title: string;
      type: string;
    };
  };

  try {
    const dotTypesRef = await db.collection('dot_types').get();
    await Promise.all(
      dotRefs.map((dotRef) => {
        const dot = dotsFromRequest[dotRef.id];
        if (dot) {
          const dotTypeRef = dotTypesRef.docs.find(
            (dotTypeRef) => dotTypeRef.id === dot.type
          );
          if (dotTypeRef) {
            return dotRef.update({
              position: new firestore.GeoPoint(
                dot.position.lat,
                dot.position.lng
              ),
              description: dot.description,
              type: dotTypeRef?.ref,
            });
          }
          return dotRef.update({
            position: new firestore.GeoPoint(
              dot.position.lat,
              dot.position.lng
            ),
            description: dot.description,
          });
        }
      })
    );

    res.json({
      success: true,
    });
  } catch (e) {
    res.status(500).json(e); // THIS IS AN ERROR!!! MAKE SURE YOU WONT EXPOSE SENSTIVE INFO HERE
  }
});

app.delete('/api/routes/:id/dot/:iddot', async function (req, res) {
  const id = req.params.id;
  const iddot = req.params.iddot;
  const routeRef = db.collection('routes').doc(id);
  try {
    const oldDots = (await routeRef.get()).get(
      'dots'
    ) as FirebaseFirestore.DocumentReference[];

    const filtredDots = oldDots.filter((dot) => dot.id !== iddot);
    await routeRef.update({ dots: filtredDots });
    await db.collection('dots').doc(iddot).delete();

    res.json({
      success: true,
    });
  } catch (e) {
    res.status(500).json(e); // THIS IS AN ERROR!!! MAKE SURE YOU WONT EXPOSE SENSTIVE INFO HERE
  }
});

app.post('/api/routes/:id/dots', async function (req, res) {
  const id = req.params.id;
  const routeRef = await db.collection('routes').doc(id);
  const dotTypesRef = await db.collection('dot_types').get();
  const dotsFromRequest = req.body as {
    description: string;
    position: {
      lat: number;
      lng: number;
    };
    title: string;
    type: string;
  }[];

  const oldDots = (await routeRef.get()).get(
    'dots'
  ) as FirebaseFirestore.DocumentReference[];
  if (oldDots) {
    Promise.all(
      oldDots.map((oldDot) => {
        return db.collection('dots').doc(oldDot.id).delete();
      })
    );
  }

  try {
    const dotRefs = dotsFromRequest.map((dotFromRequest) => {
      const dotTypeRef = dotTypesRef.docs.find(
        (dotTypeRef) => dotTypeRef.id === dotFromRequest.type
      );
      if (dotTypeRef) {
        const createdDotRef = db.collection('dots').doc();
        createdDotRef.create({
          title: dotFromRequest.title,
          description: dotFromRequest.description,
          position: new firestore.GeoPoint(
            dotFromRequest.position.lat,
            dotFromRequest.position.lng
          ),
          type: dotTypeRef?.ref,
        });
        return createdDotRef;
      }
      throw new Error(
        `dot from request ${JSON.stringify(
          dotFromRequest
        )} has an incorrect type`
      );
    });

    await routeRef.update({
      dots: dotRefs,
    });

    res.json({
      success: true,
    });
  } catch (e) {
    res.status(500).json(e); // THIS IS AN ERROR!!! MAKE SURE YOU WONT EXPOSE SENSTIVE INFO HERE
  }
});

app.listen(PORT);
