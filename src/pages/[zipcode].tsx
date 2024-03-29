import Head from 'next/head';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

import styles from './index.module.css';
import type { JsonResult } from '../utils/types';
import { categoryColorMap } from '../utils/constants';

type AddressResult = { address: { postcode: string } };
type GeolocationResult = [{ lat: number; lon: number }];

export default function Home(props: {
  aqi?: number;
  categoryName?: string;
  categoryNum?: number;
  cityState?: string;
  zipCode?: string;
}) {
  const router = useRouter();
  const [aqi, setAqi] = useState(props.aqi ?? 0);
  const [categoryName, setCategoryName] = useState(props.categoryName ?? '');
  const [categoryNum, setCategoryNum] = useState(props.categoryNum ?? '');
  const [cityState, setCityState] = useState(props.cityState ?? '');
  const [zipCode, setZipCode] = useState(props.zipCode ?? '');
  const mappedColor = useMemo(() => categoryColorMap[categoryNum as keyof typeof categoryColorMap] ?? '', [categoryNum]);

  const fetchNewAqi = useCallback(
    async (newZipCode: string) => {
      const res = await fetch(`/api/aqi?zipcode=${newZipCode}`);
      if (!res) {
        setCityState('');
        setCategoryName('');
        setCategoryNum(0);
        return setAqi(0);
      }
      const result = (await res.json()) as JsonResult;
      if (!result) {
        setCityState('');
        setCategoryName('');
        setCategoryNum(0);
        return setAqi(0);
      }
      setAqi(result.AQI);
      setCategoryName(result.Category.Name);
      setCategoryNum(result.Category.Number);
      setCityState(`${result.ReportingArea}, ${result.StateCode}`);
      setZipCode(newZipCode);
      await router.push(`/${newZipCode}`, '', { shallow: true });
    },
    [setAqi, setCityState, setZipCode, router],
  );

  const handleGeolocationSuccess = useCallback(
    async ({ latitude, longitude }: { latitude: number; longitude: number }): Promise<void> => {
      if (fetch && latitude && longitude) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        );
        const result = (await response.json()) as AddressResult;
        const postCode = result?.address?.postcode?.slice(0, 5);
        if (!!postCode) {
          await fetchNewAqi(postCode);
        }
      }
    },
    [fetchNewAqi],
  );

  const handleNotZipCode = useCallback(
    async (value: string) => {
      const [city, state] = value.split(',');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?city=${city?.trim()}${
          state ? `&state=${state.trim()}` : ''
        }&format=json`,
      );
      const result = (await response.json()) as GeolocationResult;
      if (result.length) {
        const { lat, lon } = result[0];
        if (lat && lon) {
          await handleGeolocationSuccess({ latitude: lat, longitude: lon });
        }
      }
    },
    [handleGeolocationSuccess],
  );

  const handleChangeZipCode = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      const newZipCode = (e.currentTarget.elements.namedItem('zipcode') as HTMLInputElement).value;

      if (newZipCode && newZipCode?.length === 5 && newZipCode.match(/\d/g)) {
        await fetchNewAqi(newZipCode);
      } else {
        await handleNotZipCode(newZipCode);
      }
    },
    [fetchNewAqi, handleNotZipCode],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      return void handleChangeZipCode(event);
    },
    [handleChangeZipCode],
  );

  return (
    <>
      <Head>
        <title>AQI</title>
        <meta name="description" content="Easy AQI; powered by AirNow.gov; base code generated by create t3 app" />
      </Head>
      <main className={`${styles.main} ${styles[mappedColor]}`}>
        <h1 className={styles.title}>
          AQI{aqi && aqi > -1 && ': '}
          {aqi ? aqi > -1 && aqi : categoryName}
        </h1>
        {aqi && aqi > -1 && <div>for</div>}
        <div className={styles.description}>
          {cityState && cityState} {zipCode}
        </div>
        <form className={styles.description} onSubmit={handleSubmit} method="post">
          <div>
            <input type="text" id="zipcode" name="zipcode" placeholder="zip code" />
            <label htmlFor="text" />
          </div>
          <div>
            <button type="submit">Submit</button>
          </div>
        </form>

        <footer className={`${styles.footer} ${styles[mappedColor]}`}>
          <a href="https://www.airnow.gov/" target="_blank" rel="noopener noreferrer">
            data powered by AirNow.gov API
          </a>
        </footer>
      </main>
    </>
  );
}

export async function getServerSideProps(context: { query: { zipcode: number } }) {
  const zipCode = context?.query?.zipcode;

  if (!zipCode) {
    return {
      props: {},
    };
  }

  const res = await fetch(
    `https://www.airnowapi.org/aq/forecast/zipCode/?format=application/json&zipCode=${zipCode}&distance=10&API_KEY=9E5AECAD-C761-451C-861B-14F674DB9E45`,
  );
  const result = (await res.json()) as [JsonResult];

  if (!result?.length || !result[0]) {
    return {
      props: {},
    };
  }

  const realResult = result[0];

  return {
    props: {
      aqi: realResult?.AQI,
      categoryNum: realResult?.Category?.Number,
      categoryName: realResult?.Category?.Name,
      cityState: `${realResult.ReportingArea}, ${realResult.StateCode}`,
      zipCode,
    },
  };
}
